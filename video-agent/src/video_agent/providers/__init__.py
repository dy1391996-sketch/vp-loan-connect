from .base import GenerateRequest, VideoProvider
from .local_diffusion import LocalDiffusionProvider
from .local_ffmpeg import LocalFFmpegProvider
from .optional_cloud import OptionalCloudProvider, probe_optional_cloud

PROVIDERS: dict[str, VideoProvider] = {
    LocalFFmpegProvider.id: LocalFFmpegProvider(),
    LocalDiffusionProvider.id: LocalDiffusionProvider(),
    OptionalCloudProvider.id: OptionalCloudProvider(),
}


def default_provider_id(recommended_engine: str) -> str:
    if recommended_engine == "local_diffusion":
        # Only use diffusion if it actually validates. Otherwise FFmpeg.
        status = LocalDiffusionProvider().get_status()
        if status.get("usable"):
            return LocalDiffusionProvider.id
    return LocalFFmpegProvider.id


def get_provider(provider_id: str | None, recommended_engine: str) -> VideoProvider:
    chosen = provider_id or default_provider_id(recommended_engine)
    if chosen == OptionalCloudProvider.id:
        return OptionalCloudProvider()
    return PROVIDERS.get(chosen) or LocalFFmpegProvider()
