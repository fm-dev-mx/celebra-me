# Graduation image delivery

The nine selected photographs are optimized product exports. Sources remain in the creative-ops
session identified below. Crops describe full-source export bounds; responsive rendering and social
preview crops still require visual review. Eight exports use interpolation and do not recover native
detail.

```json
{
  "sourceSession": "demo-photo-sessions/graduacion-el-siguiente-capitulo",
  "selectionSha256": "337d0d450e39e5b8ce8b028ad8e3489e70aa58cc43a802307cd458fba500d5bf",
  "officialArtwork": {
    "source": "https://isad.edu.mx/_images/logo.svg",
    "sha256": "6a2ba977df2bf4beb60d0bb2872c58c3b895357fc86bbb26a95b7ea6f7488723",
    "treatment": "Unchanged source compositions; no independent logo edits."
  },
  "recipe": {
    "engine": "sharp 0.35.5",
    "resize": "Aspect-preserving Lanczos3; full source; no crop",
    "encoding": "WebP quality 88, effort 6",
    "notice": "Eight exports are interpolated upscales, not recovered native detail."
  },
  "assets": [
    {
      "shot": "01",
      "source": "01-retrato_nativa.png",
      "sourceSha256": "8ac1bd7a96ee970e59dcbe74f2e2751eec4a02a74b57c58e7c321afc500f5157",
      "sourceDimensions": [1122, 1402],
      "file": "assets/portrait.webp",
      "sha256": "a732a6c2c01b0db779d03b57b95de1ef6b09713d2ffbe0dd04063625a9622356",
      "width": 1280,
      "height": 1600,
      "bytes": 149248,
      "upscaled": true,
      "crop": {
        "left": 0,
        "top": 0,
        "width": 1122,
        "height": 1402
      }
    },
    {
      "shot": "03",
      "source": "03-portada-v2_nativa.png",
      "sourceSha256": "25bf45a734d55b93a895984c175b42ee1b668389e0af4c1f3e8627a9709bb812",
      "sourceDimensions": [941, 1672],
      "file": "assets/hero.webp",
      "sha256": "98ed816728fa0152726c454258292d920f213090d687301f9d47db51441517c3",
      "width": 1441,
      "height": 2560,
      "bytes": 243214,
      "upscaled": true,
      "crop": {
        "left": 0,
        "top": 0,
        "width": 941,
        "height": 1672
      }
    },
    {
      "shot": "04",
      "source": "04-detalle-isad-oficial.png",
      "sourceSha256": "004588f5c70806e45a347db24b33330572ef8d57ddf4cf5105e366c0994f4bcb",
      "sourceDimensions": [1122, 1402],
      "file": "assets/interlude-01.webp",
      "sha256": "70d0890b64d18119e12bc77fcf9ea12eb8e1d98ecdd66cff7ce3c8f579fc70a7",
      "width": 1280,
      "height": 1600,
      "bytes": 129958,
      "upscaled": true,
      "crop": {
        "left": 0,
        "top": 0,
        "width": 1122,
        "height": 1402
      }
    },
    {
      "shot": "05",
      "source": "05-caminata-v2_nativa.png",
      "sourceSha256": "88ba1bb3d3509e000c98834d49bf800b8d8c30b9e9836c573c9adad9b7c66f47",
      "sourceDimensions": [1536, 1024],
      "file": "assets/gallery-01.webp",
      "sha256": "8a0589538bdab242476c3ba9160e94d3bd7477fe8f03afeff02ba1265f6c052b",
      "width": 1600,
      "height": 1067,
      "bytes": 238400,
      "upscaled": true,
      "crop": {
        "left": 0,
        "top": 0,
        "width": 1536,
        "height": 1024
      }
    },
    {
      "shot": "06",
      "source": "06-hermanas-v2_nativa.png",
      "sourceSha256": "74d6ae558606bfd229c5e621b82446f108b76100e87af31e95214b5d11870253",
      "sourceDimensions": [1536, 1024],
      "file": "assets/gallery-03.webp",
      "sha256": "b1b415330ef6a48822b5716674d4de96098861a786773bcb982622010a7df782",
      "width": 1600,
      "height": 1067,
      "bytes": 131796,
      "upscaled": true,
      "crop": {
        "left": 0,
        "top": 0,
        "width": 1536,
        "height": 1024
      }
    },
    {
      "shot": "07",
      "source": "07-sede-isad-oficial.png",
      "sourceSha256": "7702b55f21a98b19b2f7036ba1629441560f099bcbc72c1eedcb671344a3fd22",
      "sourceDimensions": [1672, 941],
      "file": "assets/venue.webp",
      "sha256": "de0758b0d05111ac82a9892cecf92a3ea053a283b95d12804544b841c1c02904",
      "width": 1672,
      "height": 941,
      "bytes": 179350,
      "upscaled": false,
      "crop": {
        "left": 0,
        "top": 0,
        "width": 1672,
        "height": 941
      }
    },
    {
      "shot": "08",
      "source": "08-cierre-isad-oficial.png",
      "sourceSha256": "96a98b5b5520adb77517d159951e599b671fd328c907c23729eb234a83a4dab3",
      "sourceDimensions": [1536, 1024],
      "file": "assets/interlude-02.webp",
      "sha256": "88f170fc052338bee5511ceea226d167f94be11d081b6f90c72f8b7f0fca4771",
      "width": 1600,
      "height": 1067,
      "bytes": 202346,
      "upscaled": true,
      "crop": {
        "left": 0,
        "top": 0,
        "width": 1536,
        "height": 1024
      }
    },
    {
      "shot": "09",
      "source": "09-papas_nativa.png",
      "sourceSha256": "83edc80bdef975861d70fa5fa340635349b3a86a39dc10d65f706e419e47a345",
      "sourceDimensions": [1536, 1024],
      "file": "assets/gallery-04.webp",
      "sha256": "2e43639b9b350f4d8072daf2aff2150ebb1d7a90c131fc01db4a9d4d1db869c8",
      "width": 1600,
      "height": 1067,
      "bytes": 156394,
      "upscaled": true,
      "crop": {
        "left": 0,
        "top": 0,
        "width": 1536,
        "height": 1024
      }
    },
    {
      "shot": "10",
      "source": "10-companeros-isad-oficial.png",
      "sourceSha256": "41dfcc4d25df3b9b0bdac9d6e2019a0e6914d1a672b54ba4026964dfd83b030c",
      "sourceDimensions": [1536, 1024],
      "file": "assets/gallery-02.webp",
      "sha256": "1bfca83548aa4a6fee44d90564fcf52cd342d3cc1515fffd6bf422bec60362c2",
      "width": 1600,
      "height": 1067,
      "bytes": 115358,
      "upscaled": true,
      "crop": {
        "left": 0,
        "top": 0,
        "width": 1536,
        "height": 1024
      }
    }
  ],
  "socialPreview": {
    "file": "public/images/demo-previews/el-siguiente-capitulo.jpg",
    "source": "assets/hero.webp",
    "crop": {
      "left": 0,
      "top": 577,
      "width": 1441,
      "height": 757
    },
    "width": 1200,
    "height": 630,
    "bytes": 67143,
    "sha256": "56da8bce5d421a5bd73d5915caaac9b657501e3066eaaf05a27e11929f0bc6f4",
    "verticalPosition": 0.32
  }
}
```
