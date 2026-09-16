from .base import GenerateRequest, VideoProvider
from .local_diffusion import LocalDiffusionProvider
from .local_ffmpeg import LocalFFmpegProvider
from .local_neural import LocalNeuralVideoProvider
from .optional_cloud import OptionalCloudProvider, probe_optional_cloud

PROVIDERS: dict[str, VideoProvider] = {
    LocalFFmpegProvider.id: LocalFFmpegProvider(),
    LocalNeuralVideoProvider.id: LocalNeuralVideoProvider(),
    LocalDiffusionProvider.id: LocalDiffusionProvider(),
    OptionalCloudProvider.id: OptionalCloudProvider(),
}


def default_provider_id(recommended_engine: str) -> str:
    if recommended_engine in {"local_neural", "local_diffusion"}:
        status = LocalNeuralVideoProvider().get_status()
        if status.get("usable"):
            return LocalNeuralVideoProvider.id
        status = LocalDiffusionProvider().get_status()
        if status.get("usable"):
            return LocalDiffusionProvider.id
    return LocalFFmpegProvider.id


def get_provider(provider_id: str | None, recommended_engine: str) -> VideoProvider:
    chosen = provider_id or default_provider_id(recommended_engine)
    if chosen == OptionalCloudProvider.id:
        return OptionalCloudProvider()
    return PROVIDERS.get(chosen) or LocalFFmpegProvider()
