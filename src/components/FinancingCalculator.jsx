import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Slider } from '@/components/ui/slider';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Calculator, DollarSign, Calendar, Percent, Landmark } from 'lucide-react';

export default function FinancingCalculator({ price }) {
  const [downPayment, setDownPayment] = useState(Math.round(price * 0.2));
  const [weeks, setWeeks] = useState(4);
  const [interestRate, setInterestRate] = useState(5);

  const loanAmount = Math.max(0, price - downPayment);
  const totalInterest = Math.round(loanAmount * (interestRate / 100));
  const totalCost = loanAmount + totalInterest;
  const weeklyRate = Math.round(totalCost / weeks);

  return (
    <Card className="bg-card/40 border-primary/20 overflow-hidden group">
      <CardHeader className="pb-3 bg-primary/5">
        <CardTitle className="text-lg flex items-center gap-2 text-primary">
          <Calculator className="h-5 w-5" />
          Finanzierungsrechner
        </CardTitle>
      </CardHeader>
      <CardContent className="pt-5 space-y-6">
        <div className="grid grid-cols-1 gap-6">
          {/* Inputs */}
          <div className="space-y-4">
            <div className="space-y-2">
              <div className="flex justify-between items-center">
                <Label className="text-xs font-bold uppercase text-muted-foreground">Anzahlung ($)</Label>
                <span className="text-xs font-mono font-bold">${downPayment.toLocaleString()}</span>
              </div>
              <Slider 
                value={[downPayment]} 
                onValueChange={([v]) => setDownPayment(v)} 
                max={price} 
                step={100}
                className="py-2"
              />
            </div>

            <div className="space-y-2">
              <div className="flex justify-between items-center">
                <Label className="text-xs font-bold uppercase text-muted-foreground">Laufzeit ({weeks} Wochen)</Label>
                <span className="text-xs font-mono font-bold">{weeks} Wo.</span>
              </div>
              <Slider 
                value={[weeks]} 
                onValueChange={([v]) => setWeeks(v)} 
                min={1} 
                max={12} 
                step={1}
                className="py-2"
              />
            </div>

            <div className="space-y-2">
              <div className="flex justify-between items-center">
                <Label className="text-xs font-bold uppercase text-muted-foreground">Zinssatz ({interestRate}%)</Label>
                <span className="text-xs font-mono font-bold">{interestRate}%</span>
              </div>
              <Slider 
                value={[interestRate]} 
                onValueChange={([v]) => setInterestRate(v)} 
                min={1} 
                max={25} 
                step={1}
                className="py-2"
              />
            </div>
          </div>

          <Separator className="bg-primary/10" />

          {/* Results - Bento Style */}
          <div className="grid grid-cols-2 gap-3">
            <div className="p-3 rounded-xl bg-primary/10 border border-primary/20">
              <p className="text-[10px] font-bold uppercase text-primary/60 mb-1">Wöchentliche Rate</p>
              <p className="text-2xl font-black text-primary">${weeklyRate.toLocaleString()}</p>
            </div>
            <div className="p-3 rounded-xl bg-muted/50 border border-border">
              <p className="text-[10px] font-bold uppercase text-muted-foreground mb-1">Finanzierungssumme</p>
              <p className="text-xl font-bold">${loanAmount.toLocaleString()}</p>
            </div>
            <div className="p-3 rounded-xl bg-muted/50 border border-border">
              <p className="text-[10px] font-bold uppercase text-muted-foreground mb-1">Zinskosten</p>
              <p className="text-xl font-bold text-destructive">${totalInterest.toLocaleString()}</p>
            </div>
            <div className="p-3 rounded-xl bg-muted/50 border border-border">
              <p className="text-[10px] font-bold uppercase text-muted-foreground mb-1">Gesamtbetrag</p>
              <p className="text-xl font-bold">${totalCost.toLocaleString()}</p>
            </div>
          </div>
        </div>

        <p className="text-[10px] text-muted-foreground text-center italic mt-2">
          * Unverbindliches Rechenbeispiel für das Rollenspiel.
        </p>
      </CardContent>
    </Card>
  );
}
