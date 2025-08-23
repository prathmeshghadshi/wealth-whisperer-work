import { useToast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
import { Download } from 'lucide-react';
import * as XLSX from 'xlsx';
import html2canvas from 'html2canvas';

interface SheetConfig {
  sheetName: string;
  data: any[];
  columns: { key: string; header: string; format?: (value: any, row?: any) => string | number }[];
  chartId?: string; // Optional chart ID for capturing chart images
}

interface ExcelDownloadProps {
  sheets: SheetConfig[];
  fileName: string;
  buttonText?: string;
  disabled?: boolean;
}

const ExcelDownload = ({ sheets, fileName, buttonText = 'Download Excel', disabled = false }: ExcelDownloadProps) => {
  const { toast } = useToast();

  const downloadExcel = async () => {
    try {
      const wb = XLSX.utils.book_new();

      // Function to capture chart as image and convert to base64
      const captureChart = async (chartId: string): Promise<string | null> => {
        const chartElement = document.getElementById(chartId);
        if (!chartElement) return null;
        const canvas = await html2canvas(chartElement, { scale: 2 });
        return canvas.toDataURL('image/png').split(',')[1]; // Return base64 string without data URI prefix
      };

      for (const sheetConfig of sheets) {
        // Convert data to sheet format
        const sheetData = [
          sheetConfig.columns.map(col => col.header), // Headers
          ...sheetConfig.data.map(row =>
            sheetConfig.columns.map(col => {
              const value = row[col.key];
              return col.format ? col.format(value, row) : value;
            })
          )
        ];

        const ws = XLSX.utils.aoa_to_sheet(sheetData);

        // Add chart image if chartId is provided
        if (sheetConfig.chartId) {
          const imageBase64 = await captureChart(sheetConfig.chartId);
          if (imageBase64) {
            ws['!images'] = ws['!images'] || [];
            ws['!images'].push({
              name: `${sheetConfig.sheetName}_chart.png`,
              data: imageBase64,
              opts: { base64: true },
              position: {
                type: 'twoCellAnchor',
                attrs: { editAs: 'oneCell' },
                from: { col: sheetData[0].length + 1, row: 0 },
                to: { col: sheetData[0].length + 11, row: 20 }
              }
            });
          }
        }

        XLSX.utils.book_append_sheet(wb, ws, sheetConfig.sheetName);
      }

      XLSX.writeFile(wb, `${fileName}_${new Date().toISOString().split('T')[0]}.xlsx`);
    } catch (error) {
      console.error('Error generating Excel report:', error);
      toast({
        title: 'Error',
        description: 'Failed to generate Excel report',
        variant: 'destructive',
      });
    }
  };

  return (
    <Button onClick={downloadExcel} disabled={disabled} className="flex items-center gap-2">
      <Download className="h-4 w-4" />
      {buttonText}
    </Button>
  );
};

export default ExcelDownload;