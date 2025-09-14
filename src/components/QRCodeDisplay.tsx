
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
    if (canvasRef.current && isPublished) {
      // Generate QR code with event joining URL
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
  }, [eventCode, isPublished]);

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
        {isPublished ? (
          <>
            <canvas ref={canvasRef} className="border rounded" />
            <p className="text-xs text-gray-600 text-center">
              Event Code: <strong>{eventCode}</strong>
            </p>
            <p className="text-xs text-gray-500 text-center max-w-[200px]">
              Participants can scan this QR code to join "{eventTitle}"
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
          </>
        ) : (
          <>
            <div className="w-[200px] h-[200px] border rounded flex items-center justify-center bg-gray-100 dark:bg-gray-800">
              <div className="text-center text-gray-500">
                <p className="text-sm font-medium">Event Not Published</p>
                <p className="text-xs">Publish event to generate QR code</p>
              </div>
            </div>
            <p className="text-xs text-gray-600 text-center">
              Event Code: <strong>{eventCode}</strong>
            </p>
            <p className="text-xs text-gray-400 text-center max-w-[200px]">
              QR code will be available after publishing the event
            </p>
          </>
        )}
      </CardContent>
    </Card>
  );
};

export default QRCodeDisplay;
