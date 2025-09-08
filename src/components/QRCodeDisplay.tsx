
import { useEffect, useRef } from 'react';
import QRCode from 'qrcode';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

interface QRCodeDisplayProps {
  eventId: string;
  eventTitle: string;
  eventCode: string;
}

const QRCodeDisplay = ({ eventId, eventTitle, eventCode }: QRCodeDisplayProps) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    if (canvasRef.current) {
      // Generate QR code with event joining URL
      const joinUrl = `${window.location.origin}/join-event/${eventCode}`;
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

  return (
    <Card className="w-fit">
      <CardHeader>
        <CardTitle className="text-sm">Event QR Code</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col items-center space-y-2">
        <canvas ref={canvasRef} className="border rounded" />
        <p className="text-xs text-gray-600 text-center">
          Event Code: <strong>{eventCode}</strong>
        </p>
        <p className="text-xs text-gray-500 text-center max-w-[200px]">
          Participants can scan this QR code to join "{eventTitle}"
        </p>
      </CardContent>
    </Card>
  );
};

export default QRCodeDisplay;
