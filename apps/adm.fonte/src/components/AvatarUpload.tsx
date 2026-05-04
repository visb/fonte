import { useCallback, useRef, useState } from 'react';
import Cropper from 'react-easy-crop';
import Webcam from 'react-webcam';
import type { Area, Point } from 'react-easy-crop';
import { Camera, Upload, User } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { getCroppedImg } from '@/lib/cropImage';

interface AvatarUploadProps {
  currentUrl?: string | null;
  onBlobChange: (blob: Blob | null) => void;
}

export function AvatarUpload({ currentUrl, onBlobChange }: AvatarUploadProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const webcamRef = useRef<Webcam>(null);

  const [preview, setPreview] = useState<string | null>(null);
  const [cropSrc, setCropSrc] = useState<string | null>(null);
  const [cropOpen, setCropOpen] = useState(false);
  const [webcamOpen, setWebcamOpen] = useState(false);
  const [webcamError, setWebcamError] = useState(false);
  const [crop, setCrop] = useState<Point>({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [croppedAreaPixels, setCroppedAreaPixels] = useState<Area | null>(null);

  const displaySrc = preview ?? currentUrl ?? null;

  const openCropFor = (src: string) => {
    setCropSrc(src);
    setCrop({ x: 0, y: 0 });
    setZoom(1);
    setCropOpen(true);
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) openCropFor(URL.createObjectURL(file));
    e.target.value = '';
  };

  const captureWebcam = () => {
    const imageSrc = webcamRef.current?.getScreenshot();
    if (!imageSrc) return;
    setWebcamOpen(false);
    openCropFor(imageSrc);
  };

  const onCropComplete = useCallback((_: Area, croppedPixels: Area) => {
    setCroppedAreaPixels(croppedPixels);
  }, []);

  const confirmCrop = async () => {
    if (!cropSrc || !croppedAreaPixels) return;
    const blob = await getCroppedImg(cropSrc, croppedAreaPixels);
    setPreview(URL.createObjectURL(blob));
    onBlobChange(blob);
    setCropOpen(false);
    setCropSrc(null);
  };

  const cancelCrop = () => {
    setCropOpen(false);
    setCropSrc(null);
  };

  return (
    <div className="flex flex-col items-center gap-3">
      <div className="w-24 h-24 rounded-full border-2 border-dashed border-muted-foreground/30 overflow-hidden flex items-center justify-center bg-muted shrink-0">
        {displaySrc ? (
          <img src={displaySrc} alt="Foto do acolhido" className="w-full h-full object-cover" />
        ) : (
          <User size={40} className="text-muted-foreground" />
        )}
      </div>

      <div className="flex gap-2">
        <Button type="button" variant="outline" size="sm" onClick={() => fileInputRef.current?.click()}>
          <Upload size={14} className="mr-1.5" />
          Arquivo
        </Button>
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => { setWebcamError(false); setWebcamOpen(true); }}
        >
          <Camera size={14} className="mr-1.5" />
          Câmera
        </Button>
      </div>

      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={handleFileChange}
      />

      {/* Webcam dialog */}
      <Dialog open={webcamOpen} onOpenChange={setWebcamOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Tirar foto</DialogTitle>
          </DialogHeader>
          <div className="rounded-lg overflow-hidden bg-black aspect-video flex items-center justify-center">
            {webcamError ? (
              <p className="text-sm text-white/70 text-center p-4">
                Câmera não disponível. Verifique as permissões ou use a opção de arquivo.
              </p>
            ) : (
              <Webcam
                ref={webcamRef}
                audio={false}
                screenshotFormat="image/jpeg"
                videoConstraints={{ facingMode: 'user' }}
                onUserMediaError={() => setWebcamError(true)}
                className="w-full"
              />
            )}
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setWebcamOpen(false)}>
              Cancelar
            </Button>
            <Button type="button" onClick={captureWebcam} disabled={webcamError}>
              Capturar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Crop dialog */}
      <Dialog open={cropOpen} onOpenChange={(open) => !open && cancelCrop()}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Enquadrar foto</DialogTitle>
          </DialogHeader>
          <div className="relative w-full rounded-lg overflow-hidden bg-black" style={{ height: 320 }}>
            {cropSrc && (
              <Cropper
                image={cropSrc}
                crop={crop}
                zoom={zoom}
                aspect={1}
                cropShape="round"
                showGrid={false}
                onCropChange={setCrop}
                onZoomChange={setZoom}
                onCropComplete={onCropComplete}
              />
            )}
          </div>
          <div className="space-y-1 px-1">
            <label className="text-xs text-muted-foreground">Zoom</label>
            <input
              type="range"
              min={1}
              max={3}
              step={0.01}
              value={zoom}
              onChange={(e) => setZoom(Number(e.target.value))}
              className="w-full accent-primary"
            />
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={cancelCrop}>
              Cancelar
            </Button>
            <Button type="button" onClick={confirmCrop}>
              Confirmar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
