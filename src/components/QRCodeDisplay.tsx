
import { useEffect, useRef } from 'react';
import QRCode from 'qrcode';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Download } from 'lucide-react';

interface QRCodeDisplayProps {
  eventId: string;
  eventTitle: string;
  eventCode: string;
  isPublished?: boolean;
}

const QRCodeDisplay = ({ eventId, eventTitle, eventCode, isPublished = true }: QRCodeDisplayProps) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    if (canvasRef.current) {
      // Generate QR code with event joining URL (works for both public and private events)
      const joinUrl = `${window.location.origin}/join/${eventCode}`;
      QRCode.toCanvas(canvasRef.current, joinUrl, {
        width: 200,
        margin: 2,
        color: {
          dark: '#000000',
          light: '#ffffff'
        }
      });
    }
  }, [eventCode]);

  const downloadQRCode = () => {
    if (canvasRef.current) {
      // Create a download link
      const link = document.createElement('a');
      link.download = `${eventTitle.replace(/[^a-zA-Z0-9]/g, '_')}_QR_Code.png`;
      link.href = canvasRef.current.toDataURL('image/png');
      link.click();
    }
  };

  return (
    <Card className="w-fit">
      <CardHeader>
        <CardTitle className="text-sm">Event QR Code</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col items-center space-y-3">
        <canvas ref={canvasRef} className="border rounded" />
        <p className="text-xs text-gray-600 text-center">
          Event Code: <strong>{eventCode}</strong>
        </p>
        <p className="text-xs text-gray-500 text-center max-w-[200px]">
          {isPublished
            ? `Participants can scan this QR code to join "${eventTitle}"`
            : `Share this QR code with invited participants to join "${eventTitle}"`
          }
        </p>
        <Button
          onClick={downloadQRCode}
          size="sm"
          variant="outline"
          className="w-full"
        >
          <Download className="w-4 h-4 mr-2" />
          Download QR Code
        </Button>
      </CardContent>
    </Card>
  );
};

export default QRCodeDisplay;
