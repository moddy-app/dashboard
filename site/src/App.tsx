import { useEffect } from 'react';
import { DatePickerDemo } from './components/DatePickerDemo';
import { TooltipProvider } from './components/ui/tooltip';

export function App() {
  useEffect(() => {
    document.documentElement.classList.add('dark');
  }, []);

  return (
    <TooltipProvider>
      <div className="flex items-center justify-center min-h-screen">
        <DatePickerDemo />
      </div>
    </TooltipProvider>
  );
}
