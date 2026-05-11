import { Slider as SliderPrimitive } from "@base-ui/react/slider"

import { cn } from "@/lib/utils"

function Slider({
 className,
 value,
 onValueChange,
 min = 0,
 max = 100,
 step = 1,
 ...props
}) {
 return (
  <SliderPrimitive.Root
   data-slot="slider"
   value={value}
   onValueChange={(val) => onValueChange?.(val)}
   min={min}
   max={max}
   step={step}
   className={cn("relative flex w-full touch-none select-none items-center", className)}
   {...props}>
   <SliderPrimitive.Control
    data-slot="slider-control"
    className="relative flex w-full items-center py-1 cursor-pointer">
    <SliderPrimitive.Track
     data-slot="slider-track"
     className="relative h-1.5 w-full grow overflow-hidden rounded-full bg-primary/20">
     <SliderPrimitive.Indicator
      data-slot="slider-indicator"
      className="absolute h-full bg-primary rounded-full transition-all" />
    </SliderPrimitive.Track>
    <SliderPrimitive.Thumb
     data-slot="slider-thumb"
     className="block h-4 w-4 rounded-full border-2 border-primary bg-background shadow-sm ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 hover:bg-primary/10 active:scale-110" />
   </SliderPrimitive.Control>
  </SliderPrimitive.Root>
 );
}

export { Slider }
