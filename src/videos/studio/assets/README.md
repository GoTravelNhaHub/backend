# assets/

Optional inputs for the video studio.

- `music/` — background music. Only add tracks you hold a license for (e.g. YouTube Audio Library,
  a purchased stock license). Then set in the video config:

  ```json
  "music": { "file": "assets/music/<track>.mp3", "license": "<source + license / URL>", "volume": 0.12 }
  ```

  Rendering refuses a music file with an empty `license`. Music is ducked under the narration.

Captured footage and screenshots are written to `output/capture/`, not here.
