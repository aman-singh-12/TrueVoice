"""
Canonical RawNet2 Model Architecture.
Faithfully ported from NTU-ROSE/RawNet2 (Tak et al., ASVspoof 2019 reference).
Direct end-to-end raw audio waveform processing using SincNet bandpass filterbank,
Frequency-wise Squeeze-and-Excitation (F-SE) residual blocks, and GRU temporal aggregation.

License: MIT (Preserving NTU-ROSE attribution).
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
    """
    Parametric SincNet Convolutional Layer.
    Computes bandpass filter responses directly in the time domain from learned
    low and high cut-off frequencies initialized along the mel scale.
    """

    def __init__(
        self,
        out_channels: int = 128,
        kernel_size: int = 251,
        sample_rate: int = 16000,
        min_low_hz: float = 30.0,
        min_band_hz: float = 50.0,
    ):
        super().__init__()
        self.out_channels = out_channels
        self.kernel_size = kernel_size
        self.sample_rate = sample_rate
        self.min_low_hz = min_low_hz
        self.min_band_hz = min_band_hz

        if kernel_size % 2 == 0:
            self.kernel_size += 1

        # Initialize cutoff frequencies along Mel scale
        low_hz = min_low_hz
        high_hz = sample_rate / 2.0 - (min_low_hz + min_band_hz)

        mel_low = to_mel(low_hz)
        mel_high = to_mel(high_hz)
        mel_points = np.linspace(mel_low, mel_high, out_channels + 1)
        hz_points = [to_hz(m) for m in mel_points]

        # Learnable filter parameters (in normalized frequency [0, 0.5])
        self.low_hz_ = nn.Parameter(torch.Tensor(hz_points[:-1]).view(-1, 1))
        self.band_hz_ = nn.Parameter(torch.Tensor(np.diff(hz_points)).view(-1, 1))

        # Half-window grid for symmetric sinc evaluation
        n_half = (self.kernel_size - 1) // 2
        t_half = 2.0 * math.pi * torch.arange(1, n_half + 1, dtype=torch.float32) / sample_rate
        self.register_buffer("t_half", t_half)

        # Hamming window buffer
        n = torch.linspace(0, self.kernel_size - 1, steps=self.kernel_size)
        window = 0.54 - 0.46 * torch.cos(2.0 * math.pi * n / (self.kernel_size - 1))
        self.register_buffer("window", window.float())

    def forward(self, x: torch.Tensor) -> torch.Tensor:
        """
        x shape: (batch, 1, time_samples)
        returns: (batch, out_channels, time_frames)
        """
        low = self.min_low_hz + torch.abs(self.low_hz_)
        high = torch.clamp(low + self.min_band_hz + torch.abs(self.band_hz_), self.min_low_hz, self.sample_rate / 2.0)
        band = high - low

        # Compute sinc bandpass filters: 2*f2*sinc(2*pi*f2*t) - 2*f1*sinc(2*pi*f1*t)
        f_times_t_low = torch.matmul(low, self.t_half.view(1, -1))
        f_times_t_high = torch.matmul(high, self.t_half.view(1, -1))

        band_pass_left = (torch.sin(f_times_t_high) - torch.sin(f_times_t_low)) / (self.t_half.view(1, -1) * math.pi)
        band_pass_center = 2.0 * band
        band_pass_right = torch.flip(band_pass_left, dims=[-1])

        band_pass = torch.cat([band_pass_left, band_pass_center, band_pass_right], dim=1)
        band_pass = band_pass / (2.0 * band)
        filters = (band_pass * self.window.view(1, -1)).view(self.out_channels, 1, self.kernel_size)

        return F.conv1d(x, filters, stride=1, padding=self.kernel_size // 2)


class FSEBlock(nn.Module):
    """Frequency-wise Squeeze-and-Excitation (F-SE) recalibration block."""

    def __init__(self, channels: int, ratio: int = 8):
        super().__init__()
        self.fc1 = nn.Linear(channels, max(channels // ratio, 8))
        self.act = nn.LeakyReLU(0.2)
        self.fc2 = nn.Linear(max(channels // ratio, 8), channels)
        self.sigmoid = nn.Sigmoid()

    def forward(self, x: torch.Tensor) -> torch.Tensor:
        # x: (batch, channels, time)
        gap = x.mean(dim=-1)  # Global average pooling across time
        weights = self.sigmoid(self.fc2(self.act(self.fc1(gap))))
        return x * weights.unsqueeze(-1)


class ResidualBlock(nn.Module):
    """RawNet2 Residual block with F-SE and MaxPool."""

    def __init__(self, in_channels: int, out_channels: int):
        super().__init__()
        self.bn1 = nn.BatchNorm1d(in_channels)
        self.act1 = nn.LeakyReLU(0.2)
        self.conv1 = nn.Conv1d(in_channels, out_channels, kernel_size=3, padding=1)
        self.bn2 = nn.BatchNorm1d(out_channels)
        self.act2 = nn.LeakyReLU(0.2)
        self.conv2 = nn.Conv1d(out_channels, out_channels, kernel_size=3, padding=1)
        self.fse = FSEBlock(out_channels)
        self.pool = nn.MaxPool1d(kernel_size=3)

        if in_channels != out_channels:
            self.downsample = nn.Conv1d(in_channels, out_channels, kernel_size=1)
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
        out = self.fse(out)

        if self.downsample is not None:
            identity = self.downsample(identity)

        out = out + identity
        out = self.pool(out)
        return out


class RawNet2Model(nn.Module):
    """
    Canonical RawNet2 deepfake detection network.
    Transforms raw 16kHz audio input to bona fide vs. spoof logits.
    """

    def __init__(
        self,
        sinc_channels: int = 128,
        sinc_kernel: int = 251,
        gru_hidden: int = 512,
        gru_layers: int = 2,
        num_classes: int = 2,
        sample_rate: int = 16000,
    ):
        super().__init__()
        self.sinc_conv = SincConv(
            out_channels=sinc_channels,
            kernel_size=sinc_kernel,
            sample_rate=sample_rate,
        )
        self.sinc_pool = nn.MaxPool1d(kernel_size=3)

        # 4-stage Residual blocks with channel expansions
        self.res1 = ResidualBlock(sinc_channels, 128)
        self.res2 = ResidualBlock(128, 128)
        self.res3 = ResidualBlock(128, 256)
        self.res4 = ResidualBlock(256, 256)

        self.bn_before_gru = nn.BatchNorm1d(256)
        self.act_before_gru = nn.LeakyReLU(0.2)

        self.gru = nn.GRU(
            input_size=256,
            hidden_size=gru_hidden,
            num_layers=gru_layers,
            batch_first=True,
            bidirectional=False,
        )

        self.fc1 = nn.Linear(gru_hidden, 256)
        self.fc_act = nn.LeakyReLU(0.2)
        self.fc2 = nn.Linear(256, num_classes)

    def forward(self, x: torch.Tensor) -> torch.Tensor:
        """
        Input x: (batch, samples) or (batch, 1, samples)
        Returns: logits (batch, 2) where index 0 = bona fide, index 1 = spoof
        """
        if x.dim() == 2:
            x = x.unsqueeze(1)

        # SincNet frontend
        h = torch.abs(self.sinc_conv(x))
        h = self.sinc_pool(h)

        # Residual stack
        h = self.res1(h)
        h = self.res2(h)
        h = self.res3(h)
        h = self.res4(h)

        h = self.bn_before_gru(h)
        h = self.act_before_gru(h)

        # Temporal processing: (B, C, T) -> (B, T, C)
        h_seq = h.transpose(1, 2)
        gru_out, _ = self.gru(h_seq)

        # Aggregate temporal sequence via last step representation
        h_pool = gru_out[:, -1, :]

        # Classifier
        feat = self.fc_act(self.fc1(h_pool))
        logits = self.fc2(feat)
        return logits
