const CANVAS_WIDTH  = 1280; // Two 640x360 tiles
const CANVAS_HEIGHT = 360;
const FRAME_RATE    = 30;

export function createCompositeStream(
  localStream:  MediaStream,
  remoteStream: MediaStream
): MediaStream {
  const canvas  = document.createElement('canvas');
  canvas.width  = CANVAS_WIDTH;
  canvas.height = CANVAS_HEIGHT;
  const ctx     = canvas.getContext('2d')!;

  const localVideo  = createHiddenVideo(localStream);
  const remoteVideo = createHiddenVideo(remoteStream);

  const interval = setInterval(() => {
    ctx.fillStyle = '#000';
    ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
    if (localVideo.readyState >= 2) {
      ctx.drawImage(localVideo,   0, 0, 640, CANVAS_HEIGHT); // Left: local
    }
    if (remoteVideo.readyState >= 2) {
      ctx.drawImage(remoteVideo, 640, 0, 640, CANVAS_HEIGHT); // Right: remote
    }
    drawLabel(ctx,   0, 'You');
    drawLabel(ctx, 640, 'Admin');
  }, 1000 / FRAME_RATE);

  // Capture canvas video track
  const videoStream = canvas.captureStream(FRAME_RATE);

  // Mix audio from both sources
  const audioContext = new AudioContext();
  const destination  = audioContext.createMediaStreamDestination();

  [localStream, remoteStream].forEach(stream => {
    if (stream.getAudioTracks().length > 0) {
      audioContext.createMediaStreamSource(stream).connect(destination);
    }
  });

  const compositeStream = new MediaStream([
    ...videoStream.getVideoTracks(),
    ...destination.stream.getAudioTracks(),
  ]);

  compositeStream.addEventListener('inactive', () => {
    clearInterval(interval);
    audioContext.close();
    localVideo.remove();
    remoteVideo.remove();
  });

  return compositeStream;
}

function createHiddenVideo(stream: MediaStream): HTMLVideoElement {
  const video      = document.createElement('video');
  video.srcObject  = stream;
  video.muted      = true;
  video.autoplay   = true;
  video.playsInline = true;
  // keep off-screen
  video.style.position = 'absolute';
  video.style.left = '-9999px';
  document.body.appendChild(video);
  return video;
}

function drawLabel(ctx: CanvasRenderingContext2D, x: number, text: string): void {
  ctx.font      = '16px Inter, sans-serif';
  ctx.fillStyle = 'rgba(255,255,255,0.8)';
  ctx.fillText(text, x + 12, CANVAS_HEIGHT - 12);
}
