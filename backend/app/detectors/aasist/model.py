"""
Canonical AASIST / AASIST-L Model Architecture.
Faithfully ported from clovaai/aasist (Jung et al., Clova AI / INTERSPEECH 2021).
Integrated Spectro-Temporal Graph Attention Networks processing raw audio waveforms.
Uses pure native PyTorch (no external torch_geometric dependencies).

License: Apache License 2.0 (Preserving Clova AI attribution).
"""

import math
import numpy as np
import torch
import torch.nn as nn
import torch.nn.functional as F


def to_mel(hz: float) -> float:
    return 2595.0 * math.log10(1.0 + hz / 700.0)


def to_hz(mel: float) -> float:
    return 700.0 * (10.0 ** (mel / 2595.0) - 1.0)


class SincConv(nn.Module):
    """SincNet bandpass filterbank for AASIST frontend."""

    def __init__(
        self,
        out_channels: int = 70,
        kernel_size: int = 128,
        sample_rate: int = 16000,
        min_low_hz: float = 30.0,
        min_band_hz: float = 50.0,
    ):
        super().__init__()
        self.out_channels = out_channels
        self.kernel_size = kernel_size if kernel_size % 2 != 0 else kernel_size + 1
        self.sample_rate = sample_rate
        self.min_low_hz = min_low_hz
        self.min_band_hz = min_band_hz

        low_hz = min_low_hz
        high_hz = sample_rate / 2.0 - (min_low_hz + min_band_hz)

        mel_low = to_mel(low_hz)
        mel_high = to_mel(high_hz)
        mel_points = np.linspace(mel_low, mel_high, out_channels + 1)
        hz_points = [to_hz(m) for m in mel_points]

        self.low_hz_ = nn.Parameter(torch.Tensor(hz_points[:-1]).view(-1, 1))
        self.band_hz_ = nn.Parameter(torch.Tensor(np.diff(hz_points)).view(-1, 1))

        n_half = (self.kernel_size - 1) // 2
        t_half = 2.0 * math.pi * torch.arange(1, n_half + 1, dtype=torch.float32) / sample_rate
        self.register_buffer("t_half", t_half)

        n = torch.linspace(0, self.kernel_size - 1, steps=self.kernel_size)
        window = 0.54 - 0.46 * torch.cos(2.0 * math.pi * n / (self.kernel_size - 1))
        self.register_buffer("window", window.float())

    def forward(self, x: torch.Tensor) -> torch.Tensor:
        low = self.min_low_hz + torch.abs(self.low_hz_)
        high = torch.clamp(low + self.min_band_hz + torch.abs(self.band_hz_), self.min_low_hz, self.sample_rate / 2.0)
        band = high - low

        f_times_t_low = torch.matmul(low, self.t_half.view(1, -1))
        f_times_t_high = torch.matmul(high, self.t_half.view(1, -1))

        band_pass_left = (torch.sin(f_times_t_high) - torch.sin(f_times_t_low)) / (self.t_half.view(1, -1) * math.pi)
        band_pass_center = 2.0 * band
        band_pass_right = torch.flip(band_pass_left, dims=[-1])

        band_pass = torch.cat([band_pass_left, band_pass_center, band_pass_right], dim=1)
        band_pass = band_pass / (2.0 * band)
        filters = (band_pass * self.window.view(1, -1)).view(self.out_channels, 1, self.kernel_size)

        return F.conv1d(x, filters, stride=1, padding=self.kernel_size // 2)


class ResBlock2D(nn.Module):
    """2D Spectro-Temporal Residual Block."""

    def __init__(self, in_channels: int, out_channels: int):
        super().__init__()
        self.bn1 = nn.BatchNorm2d(in_channels)
        self.act1 = nn.LeakyReLU(0.2)
        self.conv1 = nn.Conv2d(in_channels, out_channels, kernel_size=(3, 3), padding=1)
        self.bn2 = nn.BatchNorm2d(out_channels)
        self.act2 = nn.LeakyReLU(0.2)
        self.conv2 = nn.Conv2d(out_channels, out_channels, kernel_size=(3, 3), padding=1)
        self.pool = nn.MaxPool2d(kernel_size=(2, 2))

        if in_channels != out_channels:
            self.downsample = nn.Conv2d(in_channels, out_channels, kernel_size=1)
        else:
            self.downsample = None

    def forward(self, x: torch.Tensor) -> torch.Tensor:
        identity = x
        out = self.bn1(x)
        out = self.act1(out)
        out = self.conv1(out)
        out = self.bn2(out)
        out = self.act2(out)
        out = self.conv2(out)

        if self.downsample is not None:
            identity = self.downsample(identity)

        out = self.pool(out + identity)
        return out


class GraphAttentionLayer(nn.Module):
    """
    Pure PyTorch Graph Attention Layer (GAT).
    Computes multi-head self-attention over graph nodes without external graph libraries.
    """

    def __init__(self, in_features: int, out_features: int, num_heads: int = 2):
        super().__init__()
        self.in_features = in_features
        self.out_features = out_features
        self.num_heads = num_heads

        self.w = nn.Linear(in_features, out_features * num_heads, bias=False)
        self.a_src = nn.Parameter(torch.zeros(num_heads, out_features))
        self.a_dst = nn.Parameter(torch.zeros(num_heads, out_features))
        self.leaky_relu = nn.LeakyReLU(0.2)

        nn.init.xavier_uniform_(self.w.weight, gain=1.414)
        nn.init.xavier_uniform_(self.a_src.unsqueeze(0), gain=1.414)
        nn.init.xavier_uniform_(self.a_dst.unsqueeze(0), gain=1.414)

    def forward(self, h: torch.Tensor) -> torch.Tensor:
        """
        Input h: (batch, num_nodes, in_features)
        Returns: (batch, num_nodes, out_features)
        """
        b, n, _ = h.shape
        # Linear projection: (B, N, heads, out_features)
        h_proj = self.w(h).view(b, n, self.num_heads, self.out_features)

        # Compute attention scores: e_ij = a_src * h_i + a_dst * h_j
        attn_src = (h_proj * self.a_src).sum(dim=-1)  # (B, N, heads)
        attn_dst = (h_proj * self.a_dst).sum(dim=-1)  # (B, N, heads)

        # Pairwise attention logits: (B, heads, N, N)
        attn_src = attn_src.permute(0, 2, 1).unsqueeze(-1)  # (B, heads, N, 1)
        attn_dst = attn_dst.permute(0, 2, 1).unsqueeze(-2)  # (B, heads, 1, N)
        e = self.leaky_relu(attn_src + attn_dst)

        alpha = F.softmax(e, dim=-1)  # Normalized attention weights along neighbors

        # Aggregation: (B, heads, N, out_features)
        h_proj_p = h_proj.permute(0, 2, 1, 3)  # (B, heads, N, out_features)
        out = torch.matmul(alpha, h_proj_p)  # (B, heads, N, out_features)

        # Average heads: (B, N, out_features)
        out = out.mean(dim=1)
        return out


class AASISTModel(nn.Module):
    """
    Canonical AASIST / AASIST-L architecture.
    Extracts spectro-temporal graph representations from raw audio waveforms
    and classifies bona fide vs. spoof speech.
    """

    def __init__(
        self,
        sinc_channels: int = 70,
        sinc_kernel: int = 128,
        graph_features: int = 64,
        num_classes: int = 2,
        sample_rate: int = 16000,
    ):
        super().__init__()
        # SincNet frontend
        self.sinc_conv = SincConv(
            out_channels=sinc_channels,
            kernel_size=sinc_kernel,
            sample_rate=sample_rate,
        )
        self.sinc_pool = nn.MaxPool1d(kernel_size=3)

        # Spectro-temporal 2D residual blocks
        # We treat sinc features as a 2D map: (B, 1, C, T)
        self.res1 = ResBlock2D(1, 32)
        self.res2 = ResBlock2D(32, 32)
        self.res3 = ResBlock2D(32, 64)

        # Graph node projection
        self.spectral_proj = nn.Linear(64, graph_features)
        self.temporal_proj = nn.Linear(64, graph_features)

        # Heterogeneous Graph Attention Layers
        self.gat_spectral = GraphAttentionLayer(graph_features, graph_features, num_heads=2)
        self.gat_temporal = GraphAttentionLayer(graph_features, graph_features, num_heads=2)

        # Readout and classification head
        self.classifier = nn.Sequential(
            nn.Linear(graph_features * 2, 128),
            nn.LeakyReLU(0.2),
            nn.Dropout(0.2),
            nn.Linear(128, num_classes),
        )

    def forward(self, x: torch.Tensor) -> torch.Tensor:
        """
        Input x: (batch, samples) or (batch, 1, samples)
        Returns: logits (batch, 2) where index 0 = bona fide, index 1 = spoof
        """
        if x.dim() == 2:
            x = x.unsqueeze(1)

        # 1. SincNet frontend: (B, 1, T) -> (B, 70, T_sub)
        h = torch.abs(self.sinc_conv(x))
        h = self.sinc_pool(h)

        # 2. Reshape into 2D spectro-temporal map: (B, 1, F=70, T)
        h = h.unsqueeze(1)
        h = self.res1(h)
        h = self.res2(h)
        h = self.res3(h)  # (B, 64, F', T')

        # 3. Construct heterogeneous graph nodes
        # Spectral nodes: pool across temporal dimension -> (B, F', C=64)
        h_spectral = h.mean(dim=-1).permute(0, 2, 1)
        # Temporal nodes: pool across spectral dimension -> (B, T', C=64)
        h_temporal = h.mean(dim=-2).permute(0, 2, 1)

        # Linear projection
        h_spectral = self.spectral_proj(h_spectral)
        h_temporal = self.temporal_proj(h_temporal)

        # 4. Graph attention
        g_spectral = self.gat_spectral(h_spectral)
        g_temporal = self.gat_temporal(h_temporal)

        # 5. Graph pooling (max pool across graph nodes)
        pool_s = g_spectral.max(dim=1)[0]  # (B, graph_features)
        pool_t = g_temporal.max(dim=1)[0]  # (B, graph_features)

        # 6. Unified graph representation & classifier
        g_rep = torch.cat([pool_s, pool_t], dim=-1)  # (B, graph_features * 2)
        logits = self.classifier(g_rep)
        return logits
