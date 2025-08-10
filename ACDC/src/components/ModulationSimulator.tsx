import React, { useEffect, useRef, useState, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Slider } from '@/components/ui/slider';
import { 
  Satellite, 
  Sliders, 
  Waves, 
  BarChart3, 
  Radio,
  Play,
  Shuffle,
  Signal,
  Layers,
  RefreshCw,
  ArrowRightLeft,
  Info,
  Lightbulb,
  BookOpen
} from 'lucide-react';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
  Filler
} from 'chart.js';
import { Line } from 'react-chartjs-2';

ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
  Filler
);

interface ModulationParams {
  frequency: number;
  amplitude: number;
  bitrate: number;
  freqDev: number;
  modType: string;
  binaryData: string;
}

const ModulationSimulator: React.FC = () => {
  const [params, setParams] = useState<ModulationParams>({
    frequency: 1,
    amplitude: 1,
    bitrate: 1,
    freqDev: 0.3,
    modType: 'ask',
    binaryData: '10110010'
  });

  const canvasRefs = {
    digital1: useRef<HTMLCanvasElement>(null),
    modulated1: useRef<HTMLCanvasElement>(null),
    digital2: useRef<HTMLCanvasElement>(null),
    carrier1: useRef<HTMLCanvasElement>(null),
    carrier2: useRef<HTMLCanvasElement>(null),
    modulated2: useRef<HTMLCanvasElement>(null),
    modulated3: useRef<HTMLCanvasElement>(null),
    unmodulated: useRef<HTMLCanvasElement>(null)
  };

  const [chartData, setChartData] = useState<any>({
    labels: [],
    datasets: []
  });

  const generateRandomBinary = useCallback((length = 8) => {
    let binary = '';
    for (let i = 0; i < length; i++) {
      binary += Math.random() > 0.5 ? '1' : '0';
    }
    return binary;
  }, []);

  const drawSignal = useCallback((canvas: HTMLCanvasElement, data: number[], color: string, label: string) => {
    const ctx = canvas.getContext('2d');
    if (!ctx || data.length === 0) return;

    // Get actual canvas dimensions
    const rect = canvas.getBoundingClientRect();
    const width = rect.width;
    const height = rect.height;
    
    // Set canvas size for high DPI with better scaling
    const dpr = window.devicePixelRatio || 1;
    canvas.width = width * dpr;
    canvas.height = height * dpr;
    canvas.style.width = `${width}px`;
    canvas.style.height = `${height}px`;
    ctx.scale(dpr, dpr);

    ctx.clearRect(0, 0, width, height);

    // Enhanced grid with better visibility
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.08)';
    ctx.lineWidth = 0.5;
    ctx.beginPath();
    
    // Horizontal lines (5 divisions)
    for (let i = 0; i <= 5; i++) {
      const y = i * height / 5;
      ctx.moveTo(0, y);
      ctx.lineTo(width, y);
    }
    
    // Vertical lines (12 divisions for better time resolution)
    for (let i = 0; i <= 12; i++) {
      const x = i * width / 12;
      ctx.moveTo(x, 0);
      ctx.lineTo(x, height);
    }
    ctx.stroke();

    // Enhanced center line
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.25)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    const centerY = height / 2;
    ctx.moveTo(0, centerY);
    ctx.lineTo(width, centerY);
    ctx.stroke();

    // Enhanced signal drawing with better scaling
    const minVal = Math.min(...data);
    const maxVal = Math.max(...data);
    const range = maxVal - minVal;
    const margin = height * 0.05; // 5% margin
    
    // Apply glow effect for signal
    ctx.shadowColor = color;
    ctx.shadowBlur = 3;
    
    ctx.strokeStyle = color;
    ctx.lineWidth = 2.8;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.beginPath();

    for (let i = 0; i < data.length; i++) {
      const x = (i / (data.length - 1)) * width;
      let y;
      
      if (range > 0) {
        // Perfect scaling for signal visibility
        y = margin + (1 - (data[i] - minVal) / range) * (height - 2 * margin);
      } else {
        y = centerY;
      }
      
      if (i === 0) {
        ctx.moveTo(x, y);
      } else {
        ctx.lineTo(x, y);
      }
    }
    ctx.stroke();

    // Reset shadow
    ctx.shadowBlur = 0;

    // Enhanced label with gradient background
    const labelPadding = 12;
    const labelHeight = 28;
    ctx.font = 'bold 13px system-ui';
    const textWidth = ctx.measureText(label).width;
    
    // Create gradient for label background
    const gradient = ctx.createLinearGradient(8, 8, 8 + textWidth + labelPadding * 2, 8 + labelHeight);
    gradient.addColorStop(0, 'rgba(0, 0, 0, 0.9)');
    gradient.addColorStop(1, 'rgba(0, 0, 0, 0.7)');
    
    ctx.fillStyle = gradient;
    ctx.fillRect(8, 8, textWidth + labelPadding * 2, labelHeight);
    
    // Label border
    ctx.strokeStyle = color;
    ctx.lineWidth = 1;
    ctx.strokeRect(8, 8, textWidth + labelPadding * 2, labelHeight);
    
    ctx.fillStyle = color;
    ctx.fillText(label, 8 + labelPadding, 8 + labelHeight - 8);
  }, []);

  const generateWaveform = useCallback(() => {
    const { frequency, amplitude, bitrate, freqDev, modType, binaryData } = params;
    
    if (!/^[01]+$/.test(binaryData)) {
      alert('Please enter valid binary data (only 0s and 1s)');
      return;
    }

    const samplesPerBit = 300; // Higher resolution for smoother curves
    const bitDuration = 1000 / bitrate; // ms per bit
    
    const timeLabels: string[] = [];
    const digitalData: number[] = [];
    const carrierData: number[] = [];
    const waveformData: number[] = [];
    const unmodulatedData: number[] = [];

    for (let bitIndex = 0; bitIndex < binaryData.length; bitIndex++) {
      const bit = binaryData[bitIndex];
      
      for (let sample = 0; sample < samplesPerBit; sample++) {
        const t = bitIndex * bitDuration + (sample / samplesPerBit) * bitDuration;
        const bitProgress = sample / samplesPerBit; // 0 to 1 within the bit
        timeLabels.push(t.toFixed(1));
        
        // Digital signal with smooth transitions
        const digitalValue = bit === '1' ? 1 : 0;
        digitalData.push(digitalValue);
        
        // Perfect carrier signal
        const carrierValue = amplitude * Math.sin(2 * Math.PI * frequency * (t / 1000));
        carrierData.push(carrierValue);
        unmodulatedData.push(carrierValue);
        
        let modulatedValue = 0;
        
        switch(modType) {
          case 'ask':
          case 'bask':
            // Perfect ASK: Complete amplitude switching
            if (bit === '1') {
              modulatedValue = carrierValue;
            } else {
              modulatedValue = 0; // Complete silence for '0'
            }
            break;
            
          case 'fsk':
          case 'bfsk':
            // Perfect FSK: Smooth frequency transitions
            let effectiveFreq;
            if (bit === '1') {
              effectiveFreq = frequency;
            } else {
              effectiveFreq = frequency + freqDev;
            }
            modulatedValue = amplitude * Math.sin(2 * Math.PI * effectiveFreq * (t / 1000));
            break;
            
          case 'psk':
          case 'bpsk':
            // Perfect PSK: Instant phase transitions at bit boundaries
            const phaseShift = (bit === '1') ? 0 : Math.PI;
            modulatedValue = amplitude * Math.sin(2 * Math.PI * frequency * (t / 1000) + phaseShift);
            break;
        }
        
        waveformData.push(modulatedValue);
      }
    }

    // Update main chart with enhanced styling
    setChartData({
      labels: timeLabels,
      datasets: [
        {
          label: 'Digital Signal',
          data: digitalData,
          borderColor: '#76ff03',
          backgroundColor: 'rgba(118, 255, 3, 0.1)',
          borderWidth: 4,
          pointRadius: 0,
          fill: false,
          yAxisID: 'y1',
          tension: 0, // Sharp edges for digital signal
        },
        {
          label: 'Modulated Signal',
          data: waveformData,
          borderColor: '#4fc3f7',
          backgroundColor: 'rgba(79, 195, 247, 0.15)',
          borderWidth: 3,
          pointRadius: 0,
          fill: true,
          yAxisID: 'y',
          tension: 0.1, // Slight smoothing for analog signal
        }
      ]
    });

    // Enhanced canvas drawing with delay for proper rendering
    setTimeout(() => {
      Object.entries(canvasRefs).forEach(([key, ref]) => {
        if (ref.current) {
          const canvas = ref.current;
          
          switch(key) {
            case 'digital1':
            case 'digital2':
              drawSignal(canvas, digitalData, '#76ff03', 'Digital Signal');
              break;
            case 'modulated1':
            case 'modulated2':
            case 'modulated3':
              drawSignal(canvas, waveformData, '#4fc3f7', 'Modulated Signal');
              break;
            case 'carrier1':
            case 'carrier2':
              drawSignal(canvas, carrierData, '#ff9800', 'Carrier Signal');
              break;
            case 'unmodulated':
              drawSignal(canvas, unmodulatedData, '#bb86fc', 'Unmodulated Carrier');
              break;
          }
        }
      });
    }, 150);
  }, [params, drawSignal]);

  useEffect(() => {
    // Initialize canvases on mount
    Object.entries(canvasRefs).forEach(([key, ref]) => {
      if (ref.current) {
        const canvas = ref.current;
        canvas.width = canvas.offsetWidth * 2; // Higher resolution
        canvas.height = canvas.offsetHeight * 2;
        canvas.style.width = `${canvas.offsetWidth}px`;
        canvas.style.height = `${canvas.offsetHeight}px`;
        const ctx = canvas.getContext('2d');
        if (ctx) {
          ctx.scale(2, 2); // Scale for high DPI
        }
      }
    });
  }, []);

  const updateParam = (key: keyof ModulationParams, value: any) => {
    setParams(prev => ({ ...prev, [key]: value }));
  };

  const handleRandomBinary = () => {
    updateParam('binaryData', generateRandomBinary(8));
  };

  const getModulationTitle = () => {
    const titles = {
      ask: 'ASK Modulation',
      fsk: 'FSK Modulation', 
      psk: 'PSK Modulation',
      bask: 'BASK Modulation',
      bfsk: 'BFSK Modulation',
      bpsk: 'BPSK Modulation'
    };
    return titles[params.modType as keyof typeof titles] || 'Modulation';
  };

  const chartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        display: false
      },
      title: {
        display: true,
        text: getModulationTitle(),
        color: '#FFFFFF',
        font: { size: 18, weight: 'bold' as const }
      }
    },
    scales: {
      x: {
        title: {
          display: true,
          text: 'Time (ms)',
          color: '#FFFFFF',
          font: { size: 12, weight: 'bold' as const }
        },
        grid: { color: 'rgba(255, 255, 255, 0.1)' },
        ticks: { color: '#FFFFFF' }
      },
      y: {
        title: {
          display: true,
          text: 'Amplitude (V)',
          color: '#FFFFFF',
          font: { size: 12, weight: 'bold' as const }
        },
        grid: { color: 'rgba(255, 255, 255, 0.1)' },
        ticks: { color: '#FFFFFF' },
        suggestedMin: -2.5,
        suggestedMax: 2.5,
        position: 'left' as const
      },
      y1: {
        position: 'right' as const,
        suggestedMin: -0.2,
        suggestedMax: 1.2,
        grid: { drawOnChartArea: false },
        ticks: { color: '#FFFFFF' }
      }
    },
    animation: {
      duration: 400,
      easing: 'easeOutQuart' as const
    }
  };

  const SignalCanvas: React.FC<{ canvasRef: React.RefObject<HTMLCanvasElement> }> = ({ canvasRef }) => (
    <canvas 
      ref={canvasRef} 
      className="w-full h-full block"
      style={{ 
        background: 'rgba(10, 20, 40, 0.8)',
        borderRadius: '8px'
      }}
    />
  );

  return (
    <div className="min-h-screen p-4 space-y-6 animate-fade-in">
      {/* Header */}
      <div className="text-center space-y-4 p-8 card-enhanced rounded-xl animate-scale-in">
        <div className="flex items-center justify-center gap-3 mb-4">
          <Satellite className="w-12 h-12 text-primary animate-signal-pulse" />
          <h1 className="text-5xl font-bold bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent">
            Digital Modulation Simulator
          </h1>
        </div>
        <p className="text-xl text-muted-foreground max-w-4xl mx-auto leading-relaxed">
          Visualize ASK, FSK, PSK, BASK, BFSK, and BPSK modulation with perfect signal clarity
        </p>
      </div>

      {/* Controls */}
      <Card className="card-enhanced animate-fade-in" style={{ animationDelay: '0.1s' }}>
        <CardHeader>
          <CardTitle className="flex items-center gap-3 text-2xl">
            <Sliders className="w-8 h-8 text-primary" />
            Simulation Controls
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            {/* Modulation Parameters */}
            <div className="space-y-6 p-6 rounded-xl bg-muted/50 border border-border">
              <h3 className="text-xl font-semibold flex items-center gap-2 text-accent">
                <Waves className="w-6 h-6" />
                Modulation Parameters
              </h3>
              
              <div className="space-y-4">
                <div>
                  <Label>Carrier Frequency: {params.frequency} kHz</Label>
                  <Slider
                    value={[params.frequency]}
                    onValueChange={(value) => updateParam('frequency', value[0])}
                    min={0.5}
                    max={3}
                    step={0.1}
                    className="mt-2"
                  />
                </div>
                
                <div>
                  <Label>Signal Amplitude: {params.amplitude} V</Label>
                  <Slider
                    value={[params.amplitude]}
                    onValueChange={(value) => updateParam('amplitude', value[0])}
                    min={0.1}
                    max={2}
                    step={0.1}
                    className="mt-2"
                  />
                </div>
                
                <div>
                  <Label>Bit Rate: {params.bitrate} kbps</Label>
                  <Slider
                    value={[params.bitrate]}
                    onValueChange={(value) => updateParam('bitrate', value[0])}
                    min={0.5}
                    max={5}
                    step={0.1}
                    className="mt-2"
                  />
                </div>
                
                <div>
                  <Label>Frequency Deviation (FSK/BFSK): {params.freqDev} kHz</Label>
                  <Slider
                    value={[params.freqDev]}
                    onValueChange={(value) => updateParam('freqDev', value[0])}
                    min={0.1}
                    max={1}
                    step={0.1}
                    className="mt-2"
                  />
                </div>
              </div>
            </div>

            {/* Configuration */}
            <div className="space-y-6 p-6 rounded-xl bg-muted/50 border border-border">
              <h3 className="text-xl font-semibold flex items-center gap-2 text-accent">
                <Radio className="w-6 h-6" />
                Configuration
              </h3>
              
              <div className="space-y-4">
                <div>
                  <Label>Modulation Type</Label>
                  <Select value={params.modType} onValueChange={(value) => updateParam('modType', value)}>
                    <SelectTrigger className="mt-2">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="ask">Amplitude Shift Keying (ASK)</SelectItem>
                      <SelectItem value="fsk">Frequency Shift Keying (FSK)</SelectItem>
                      <SelectItem value="psk">Phase Shift Keying (PSK)</SelectItem>
                      <SelectItem value="bask">Binary ASK (BASK)</SelectItem>
                      <SelectItem value="bfsk">Binary FSK (BFSK)</SelectItem>
                      <SelectItem value="bpsk">Binary PSK (BPSK)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                
                <div>
                  <Label>Binary Input</Label>
                  <Input
                    value={params.binaryData}
                    onChange={(e) => updateParam('binaryData', e.target.value)}
                    placeholder="Enter binary data (e.g. 1010)"
                    className="mt-2 font-mono"
                  />
                </div>
                
                <div className="flex gap-4">
                  <Button 
                    onClick={generateWaveform} 
                    className="flex-1 glow-effect hover:scale-105 transition-all duration-300"
                  >
                    <Play className="w-5 h-5 mr-2" />
                    Run Simulation
                  </Button>
                  <Button 
                    onClick={handleRandomBinary} 
                    variant="secondary" 
                    className="flex-1 hover:scale-105 transition-all duration-300"
                  >
                    <Shuffle className="w-5 h-5 mr-2" />
                    Random
                  </Button>
                </div>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Main Visualization */}
      <Card className="card-enhanced animate-fade-in" style={{ animationDelay: '0.2s' }}>
        <CardHeader>
          <CardTitle className="flex items-center gap-3 text-2xl">
            <BarChart3 className="w-8 h-8 text-primary" />
            Modulation Visualization
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="relative h-96 rounded-xl overflow-hidden border border-border animate-scale-in" style={{ animationDelay: '0.3s' }}>
            <div className="absolute top-4 left-0 right-0 z-10 flex flex-col items-center gap-2">
              <h2 className="text-2xl font-bold text-white mb-0">{getModulationTitle()}</h2>
              <div className="flex items-center justify-center gap-10">
                <div className="flex items-center gap-2">
                  <svg width="40" height="30" viewBox="0 0 40 30" className="text-[#76ff03]">
                    <path d="M5 15h8v-10h14v20h8" stroke="currentColor" strokeWidth="3" fill="none"/>
                  </svg>
                  <span className="text-white text-base font-medium whitespace-nowrap">Digital Signal</span>
                </div>
                <div className="flex items-center gap-2">
                  <svg width="40" height="30" viewBox="0 0 40 30" className="text-[#4fc3f7]">
                    <path d="M2 15 C 8 5, 16 25, 24 5, 32 25, 38 15" stroke="currentColor" strokeWidth="3" fill="none"/>
                  </svg>
                  <span className="text-white text-base font-medium whitespace-nowrap">Modulated Signal</span>
                </div>
              </div>
            </div>
            <div className="w-full h-full pt-20">
              <Line 
                data={chartData} 
                options={{
                  responsive: true,
                  maintainAspectRatio: false,
                  plugins: {
                    legend: { display: false },
                    title: { display: false },
                    tooltip: { enabled: false }
                  },
                  scales: {
                    x: {
                      title: {
                        display: true,
                        text: 'Time (ms)',
                        color: '#FFFFFF',
                        font: { size: 12, weight: 'bold' }
                      },
                      grid: { color: 'rgba(255, 255, 255, 0.1)' },
                      ticks: { color: '#FFFFFF' }
                    },
                    y: {
                      title: {
                        display: true,
                        text: 'Amplitude (V)',
                        color: '#FFFFFF',
                        font: { size: 12, weight: 'bold' }
                      },
                      grid: { color: 'rgba(255, 255, 255, 0.1)' },
                      ticks: { color: '#FFFFFF' },
                      suggestedMin: -2.5,
                      suggestedMax: 2.5
                    }
                  }
                }} 
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Comparative Analysis */}
      <Card className="card-enhanced animate-fade-in" style={{ animationDelay: '0.4s' }}>
        <CardHeader>
          <CardTitle className="flex items-center gap-3 text-2xl">
            <Layers className="w-8 h-8 text-primary" />
            Comparative Signal Analysis
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 gap-6">
            {/* Digital vs Modulated */}
            <div className="space-y-4 animate-scale-in" style={{ animationDelay: '0.5s' }}>
              <h3 className="text-lg font-semibold flex items-center gap-2 text-signal-blue">
                <Signal className="w-5 h-5" />
                Digital vs Modulated
              </h3>
              <div className="h-80 rounded-lg overflow-hidden border border-border bg-muted/20 hover:border-primary transition-colors duration-300">
                <div className="h-1/2 relative border-b border-border">
                  <div className="absolute top-2 left-2 text-xs font-medium bg-black/80 text-signal-green px-2 py-1 rounded z-10">
                    Digital Signal
                  </div>
                  <SignalCanvas canvasRef={canvasRefs.digital1} />
                </div>
                <div className="h-1/2 relative">
                  <div className="absolute top-2 left-2 text-xs font-medium bg-black/80 text-signal-blue px-2 py-1 rounded z-10">
                    Modulated Signal
                  </div>
                  <SignalCanvas canvasRef={canvasRefs.modulated1} />
                </div>
              </div>
            </div>

            {/* Digital vs Carrier */}
            <div className="space-y-4 animate-scale-in" style={{ animationDelay: '0.6s' }}>
              <h3 className="text-lg font-semibold flex items-center gap-2 text-signal-orange">
                <Waves className="w-5 h-5" />
                Digital vs Carrier
              </h3>
              <div className="h-80 rounded-lg overflow-hidden border border-border bg-muted/20 hover:border-primary transition-colors duration-300">
                <div className="h-1/2 relative border-b border-border">
                  <div className="absolute top-2 left-2 text-xs font-medium bg-black/80 text-signal-green px-2 py-1 rounded z-10">
                    Digital Signal
                  </div>
                  <SignalCanvas canvasRef={canvasRefs.digital2} />
                </div>
                <div className="h-1/2 relative">
                  <div className="absolute top-2 left-2 text-xs font-medium bg-black/80 text-signal-orange px-2 py-1 rounded z-10">
                    Carrier Signal
                  </div>
                  <SignalCanvas canvasRef={canvasRefs.carrier1} />
                </div>
              </div>
            </div>

            {/* Carrier vs Modulated */}
            <div className="space-y-4 animate-scale-in" style={{ animationDelay: '0.7s' }}>
              <h3 className="text-lg font-semibold flex items-center gap-2 text-signal-green">
                <RefreshCw className="w-5 h-5" />
                Carrier vs Modulated
              </h3>
              <div className="h-80 rounded-lg overflow-hidden border border-border bg-muted/20 hover:border-primary transition-colors duration-300">
                <div className="h-1/2 relative border-b border-border">
                  <div className="absolute top-2 left-2 text-xs font-medium bg-black/80 text-signal-orange px-2 py-1 rounded z-10">
                    Carrier Signal
                  </div>
                  <SignalCanvas canvasRef={canvasRefs.carrier2} />
                </div>
                <div className="h-1/2 relative">
                  <div className="absolute top-2 left-2 text-xs font-medium bg-black/80 text-signal-blue px-2 py-1 rounded z-10">
                    Modulated Signal
                  </div>
                  <SignalCanvas canvasRef={canvasRefs.modulated2} />
                </div>
              </div>
            </div>

            {/* Modulated vs Unmodulated */}
            <div className="space-y-4 animate-scale-in" style={{ animationDelay: '0.8s' }}>
              <h3 className="text-lg font-semibold flex items-center gap-2 text-signal-purple">
                <ArrowRightLeft className="w-5 h-5" />
                Modulated vs Unmodulated
              </h3>
              <div className="h-80 rounded-lg overflow-hidden border border-border bg-muted/20 hover:border-primary transition-colors duration-300">
                <div className="h-1/2 relative border-b border-border">
                  <div className="absolute top-2 left-2 text-xs font-medium bg-black/80 text-signal-blue px-2 py-1 rounded z-10">
                    Modulated Signal
                  </div>
                  <SignalCanvas canvasRef={canvasRefs.modulated3} />
                </div>
                <div className="h-1/2 relative">
                  <div className="absolute top-2 left-2 text-xs font-medium bg-black/80 text-signal-purple px-2 py-1 rounded z-10">
                    Unmodulated Carrier
                  </div>
                  <SignalCanvas canvasRef={canvasRefs.unmodulated} />
                </div>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Educational Content */}
      <Card className="card-enhanced animate-fade-in" style={{ animationDelay: '0.9s' }}>
        <CardHeader>
          <CardTitle className="flex items-center gap-3 text-2xl">
            <BookOpen className="w-8 h-8 text-primary" />
            Modulation Techniques
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
            <div className="p-6 rounded-xl bg-muted/50 border border-border hover:border-primary transition-all duration-300 hover:scale-105">
              <h3 className="text-xl font-semibold mb-4 flex items-center gap-2 text-signal-blue">
                <Signal className="w-6 h-6" />
                ASK/BASK
              </h3>
              <p className="text-sm text-muted-foreground leading-relaxed mb-4">
                <span className="text-warning font-semibold">Amplitude Shift Keying</span> represents digital data as variations 
                in the amplitude of a carrier wave. Binary 1 is represented by a carrier wave at constant amplitude, 
                and binary 0 by no carrier wave.
              </p>
              <div className="bg-black/40 p-3 rounded-lg font-mono text-sm text-accent text-center">
                s(t) = A(t) · cos(2πf<sub>c</sub>t)
              </div>
            </div>

            <div className="p-6 rounded-xl bg-muted/50 border border-border hover:border-primary transition-all duration-300 hover:scale-105">
              <h3 className="text-xl font-semibold mb-4 flex items-center gap-2 text-signal-orange">
                <Waves className="w-6 h-6" />
                FSK/BFSK
              </h3>
              <p className="text-sm text-muted-foreground leading-relaxed mb-4">
                <span className="text-warning font-semibold">Frequency Shift Keying</span> represents digital data as changes 
                in the frequency of a carrier wave. Binary 1 is represented by one frequency, and binary 0 by a different frequency.
              </p>
              <div className="bg-black/40 p-3 rounded-lg font-mono text-sm text-accent text-center">
                s(t) = A · cos(2πf<sub>bit</sub>t)
              </div>
            </div>

            <div className="p-6 rounded-xl bg-muted/50 border border-border hover:border-primary transition-all duration-300 hover:scale-105">
              <h3 className="text-xl font-semibold mb-4 flex items-center gap-2 text-signal-green">
                <RefreshCw className="w-6 h-6" />
                PSK/BPSK
              </h3>
              <p className="text-sm text-muted-foreground leading-relaxed mb-4">
                <span className="text-warning font-semibold">Phase Shift Keying</span> represents digital data as changes 
                in the phase of a carrier wave. Binary digits are represented by shifting the phase of the carrier wave by 180 degrees.
              </p>
              <div className="bg-black/40 p-3 rounded-lg font-mono text-sm text-accent text-center">
                s(t) = A · cos(2πf<sub>c</sub>t + φ<sub>bit</sub>)
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="p-6 rounded-xl bg-muted/50 border-l-4 border-l-primary">
              <h3 className="text-lg font-semibold mb-3 flex items-center gap-2 text-accent">
                <Info className="w-5 h-5" />
                About This Simulator
              </h3>
              <p className="text-sm text-muted-foreground leading-relaxed">
                This enhanced simulator provides clear visualization of digital modulation techniques. 
                The comparative signal views allow for detailed analysis of how digital signals modulate carrier waves.
              </p>
            </div>

            <div className="p-6 rounded-xl bg-muted/50 border-l-4 border-l-accent">
              <h3 className="text-lg font-semibold mb-3 flex items-center gap-2 text-warning">
                <Lightbulb className="w-5 h-5" />
                Educational Value
              </h3>
              <p className="text-sm text-muted-foreground leading-relaxed">
                By comparing signals through vertically stacked views, students can clearly see the relationship 
                between digital inputs, carrier waves, and modulated outputs.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Footer */}
      <div className="text-center py-8 border-t border-border">
        <p className="text-muted-foreground">
          Enhanced Digital Modulation Simulator | Developed by{' '}
          <a 
            href="https://www.linkedin.com/in/venkata-dinesh-reddy-p" 
            className="text-primary hover:text-accent transition-colors underline"
            target="_blank"
            rel="noopener noreferrer"
          >
            Dinesh Reddy
          </a>{' '}
          | © 2025
        </p>
        <p className="text-sm text-muted-foreground mt-2">
          Designed for Electronics and Communication Engineering students
        </p>
      </div>
    </div>
  );
};

export default ModulationSimulator;