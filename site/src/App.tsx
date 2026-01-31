import { DatePickerDemo } from './components/DatePickerDemo';
import { TooltipProvider } from './components/ui/tooltip';

export function App() {
  return (
    <TooltipProvider>
      <div className="flex items-center justify-center min-h-screen">
        <DatePickerDemo />
      </div>
    </TooltipProvider>
  );
}
