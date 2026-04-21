<!DOCTYPE html>

<html class="dark" lang="en"><head>
<meta charset="utf-8"/>
<meta content="width=device-width, initial-scale=1.0" name="viewport"/>
<title>PulmoVision | Scan Analysis</title>
<script src="https://cdn.tailwindcss.com?plugins=forms,container-queries"></script>
<link href="https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@300;400;500;600;700&amp;family=Inter:wght@400;500;600;700&amp;display=swap" rel="stylesheet"/>
<link href="https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:wght,FILL@100..700,0..1&amp;display=swap" rel="stylesheet"/>
<link href="https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:wght,FILL@100..700,0..1&amp;display=swap" rel="stylesheet"/>
<script id="tailwind-config">
      tailwind.config = {
        darkMode: "class",
        theme: {
          extend: {
            "colors": {
                    "on-error-container": "#ffdad6",
                    "tertiary-fixed": "#ffdad6",
                    "secondary": "#ffe2ab",
                    "surface": "#10141a",
                    "surface-container-high": "#262a31",
                    "secondary-fixed": "#ffdfa0",
                    "primary": "#c3f5ff",
                    "tertiary": "#ffe8e5",
                    "secondary-fixed-dim": "#fbbc00",
                    "secondary-container": "#ffbf00",
                    "surface-container": "#1c2026",
                    "primary-fixed": "#9cf0ff",
                    "outline": "#849396",
                    "on-primary-fixed": "#001f24",
                    "on-error": "#690005",
                    "on-primary-fixed-variant": "#004f58",
                    "on-primary-container": "#00626e",
                    "on-tertiary-fixed-variant": "#93000c",
                    "error": "#ffb4ab",
                    "primary-container": "#00e5ff",
                    "surface-container-highest": "#31353c",
                    "outline-variant": "#3b494c",
                    "on-tertiary-container": "#b60012",
                    "tertiary-fixed-dim": "#ffb4ab",
                    "surface-variant": "#31353c",
                    "surface-bright": "#353940",
                    "on-background": "#dfe2eb",
                    "background": "#10141a",
                    "on-secondary-container": "#6d5000",
                    "on-tertiary": "#690006",
                    "inverse-on-surface": "#2d3137",
                    "primary-fixed-dim": "#00daf3",
                    "on-secondary": "#402d00",
                    "tertiary-container": "#ffc2bb",
                    "surface-container-lowest": "#0a0e14",
                    "inverse-surface": "#dfe2eb",
                    "inverse-primary": "#006875",
                    "on-primary": "#00363d",
                    "on-tertiary-fixed": "#410002",
                    "on-secondary-fixed-variant": "#5c4300",
                    "surface-tint": "#00daf3",
                    "on-surface-variant": "#bac9cc",
                    "error-container": "#93000a",
                    "surface-dim": "#10141a",
                    "on-surface": "#dfe2eb",
                    "surface-container-low": "#181c22",
                    "on-secondary-fixed": "#261a00"
            },
            "borderRadius": {
                    "DEFAULT": "0.125rem",
                    "lg": "0.25rem",
                    "xl": "0.5rem",
                    "full": "0.75rem"
            },
            "fontFamily": {
                    "headline": ["Space Grotesk"],
                    "body": ["Inter"],
                    "label": ["Inter"]
            }
          },
        }
      }
    </script>
<style>
        body { background-color: #0a0e14; }
        .glass-panel {
            background: rgba(49, 53, 60, 0.4);
            backdrop-filter: blur(20px);
            -webkit-backdrop-filter: blur(20px);
        }
        .glow-border {
            border: 1px solid rgba(0, 229, 255, 0.15);
        }
        .material-symbols-outlined {
            font-variation-settings: 'FILL' 0, 'wght' 300, 'GRAD' 0, 'opsz' 24;
        }
        .scan-grid {
            background-image: radial-gradient(rgba(0, 229, 255, 0.05) 1px, transparent 0);
            background-size: 40px 40px;
        }
    </style>
</head>
<body class="font-body text-on-surface overflow-hidden">
<!-- TopNavBar -->
<header class="fixed top-0 w-full z-50 bg-slate-950/40 backdrop-blur-xl shadow-[0_8px_32px_0_rgba(0,0,0,0.36)] flex justify-between items-center px-10 py-6">
<div class="flex items-center gap-8">
<h1 class="text-2xl font-light tracking-tighter text-cyan-400 drop-shadow-[0_0_8px_rgba(0,229,255,0.5)] font-headline uppercase">PulmoVision</h1>
<nav class="hidden md:flex gap-8">
<a class="font-headline uppercase tracking-widest text-xs transition-all text-slate-400/80 hover:text-cyan-200 hover:bg-white/5 px-2 py-1" href="#">Dashboard</a>
<a class="font-headline uppercase tracking-widest text-xs transition-all text-cyan-300 border-b-2 border-cyan-400/50 pb-1 px-2 py-1" href="#">Analytics</a>
<a class="font-headline uppercase tracking-widest text-xs transition-all text-slate-400/80 hover:text-cyan-200 hover:bg-white/5 px-2 py-1" href="#">History</a>
<a class="font-headline uppercase tracking-widest text-xs transition-all text-slate-400/80 hover:text-cyan-200 hover:bg-white/5 px-2 py-1" href="#">Settings</a>
</nav>
</div>
<div class="flex items-center gap-6">
<button class="material-symbols-outlined text-cyan-400 hover:scale-105 transition-all">notifications</button>
<button class="material-symbols-outlined text-cyan-400 hover:scale-105 transition-all">account_circle</button>
</div>
</header>
<!-- SideNavBar -->
<aside class="fixed left-0 top-0 h-screen w-72 bg-slate-950/20 backdrop-blur-2xl border-r border-white/5 z-40 shadow-[20px_0_40px_rgba(0,0,0,0.5)] flex flex-col pt-24 pb-8">
<div class="px-8 mb-10">
<div class="flex items-center gap-4 mb-4">
<div class="w-12 h-12 rounded-full overflow-hidden border border-cyan-400/30">
<img class="w-full h-full object-cover" data-alt="professional portrait of a medical doctor in a dark modern clinic setting with soft cyan lighting" src="https://lh3.googleusercontent.com/aida-public/AB6AXuCvzmdsZZ3BUTcTQB5Bx_iq1pJxvzWJeFok9NxwV12a6dnrj3FZUiYkiA3Lq3FXxxThumQEM7_ZZFeYQxJT0rjIz9RV1IqdcR1Dg3gNwfIjIg7PS2vXz7CL0wccU0PTO7DAweNkVZu9l8MVBlIB8sedabgo-xYgh1phxgu2Z-_H83JgayeFkJNFXAaMeszuG372l3hwcsvqbua8XWGZvZTEk0uwgzudkk6EG4q6ChL5Vr-7paSpbvXdHq77f8z6IoysGwyUGPgV0zyU"/>
</div>
<div>
<p class="font-headline font-bold text-cyan-400 text-sm">AI Diagnostician</p>
<p class="text-[10px] text-slate-500 uppercase tracking-widest">Precision Level: Alpha</p>
</div>
</div>
<button class="w-full py-3 bg-cyan-500/10 text-cyan-400 font-headline font-medium rounded-md border border-cyan-400/20 hover:bg-cyan-500/20 transition-all text-sm uppercase tracking-tighter">Initialize Analysis</button>
</div>
<nav class="flex flex-col gap-1">
<a class="flex items-center gap-4 px-8 py-4 bg-cyan-500/10 text-cyan-400 border-r-2 border-cyan-400 translate-x-1 duration-200" href="#">
<span class="material-symbols-outlined">clinical_notes</span>
<span class="font-headline font-medium">Scan</span>
</a>
<a class="flex items-center gap-4 px-8 py-4 text-slate-500 hover:bg-white/5 hover:text-slate-200 transition-all" href="#">
<span class="material-symbols-outlined">group</span>
<span class="font-headline font-medium">Patients</span>
</a>
<a class="flex items-center gap-4 px-8 py-4 text-slate-500 hover:bg-white/5 hover:text-slate-200 transition-all" href="#">
<span class="material-symbols-outlined">science</span>
<span class="font-headline font-medium">Research</span>
</a>
<a class="flex items-center gap-4 px-8 py-4 text-slate-500 hover:bg-white/5 hover:text-slate-200 transition-all" href="#">
<span class="material-symbols-outlined">biotech</span>
<span class="font-headline font-medium">Lab</span>
</a>
</nav>
</aside>
<!-- Main Content -->
<main class="ml-72 pt-24 h-screen flex flex-col">
<div class="flex flex-1 overflow-hidden">
<!-- Central Visualization -->
<section class="flex-1 relative scan-grid flex items-center justify-center p-10">
<!-- 3D Model Placeholder Container -->
<div class="relative w-full h-full max-w-4xl flex items-center justify-center">
<img class="w-full h-auto object-contain opacity-80 mix-blend-screen drop-shadow-[0_0_40px_rgba(0,229,255,0.2)]" data-alt="highly detailed anatomical 3D lung visualization with luminescent cyan and electric blue heatmaps and floating data points" src="https://lh3.googleusercontent.com/aida-public/AB6AXuDw-I8boJa6VB0d00HvIC1T4krUAHjMCAKPX4YPif6q2_Q4mHWnNNbaN1UbGk3Ei2m-P2pqOjczUsnQnP4PKpvzKtK7tUnOT-8UlK_pYQ7j68nq-6_ST8_40QGXitL3MTPefoFzS9ys3Ih1CSZ6rerdrsiaEBlDW0XT6FA-9iuJx_EwfP76dij9GZFQvZJiaBEFW4ft8YQgrxgIhvuCHCYuwJFqed_ZhBPseO_i1m6klrapHe7Rr6tVkK_jG4t1vMC54F9zE0egROho"/>
<!-- AI Bounding Boxes -->
<div class="absolute top-[35%] left-[60%] w-24 h-24 border-2 border-cyan-400/60 rounded-lg shadow-[0_0_20px_rgba(0,229,255,0.4)] animate-pulse">
<div class="absolute -top-8 left-0 flex flex-col">
<span class="bg-cyan-400 text-slate-950 text-[10px] px-2 py-0.5 font-bold uppercase">Nodule Detected</span>
<span class="text-cyan-400 text-[10px] font-mono mt-1">Density: 0.85</span>
</div>
</div>
<!-- Floating Data Points -->
<div class="absolute top-1/4 left-1/3 p-3 glass-panel glow-border rounded-md">
<p class="text-[10px] text-cyan-300 font-headline uppercase tracking-tighter">Segment L-24</p>
<p class="text-xl font-headline font-light text-on-surface">Normal Range</p>
</div>
</div>
<!-- HUD Overlays -->
<div class="absolute top-10 left-10 flex flex-col gap-2">
<div class="flex items-center gap-2">
<div class="w-2 h-2 bg-cyan-400 rounded-full"></div>
<span class="text-[10px] uppercase tracking-widest text-slate-400">System: Active</span>
</div>
<div class="flex items-center gap-2">
<div class="w-2 h-2 bg-secondary-container rounded-full"></div>
<span class="text-[10px] uppercase tracking-widest text-slate-400">Stream: Stable</span>
</div>
</div>
</section>
<!-- Right Sidebar: Findings & Diagnostics -->
<aside class="w-[400px] bg-surface-container-low border-l border-white/5 p-8 flex flex-col gap-8 overflow-y-auto">
<div>
<h2 class="font-headline text-2xl font-light text-cyan-400 mb-6 lowercase">clinical findings</h2>
<div class="space-y-6">
<!-- Diagnostic Metric -->
<div class="space-y-2">
<div class="flex justify-between items-end">
<label class="text-[10px] font-bold uppercase tracking-widest text-slate-400">Opacity</label>
<span class="text-sm font-mono text-cyan-300">14.2%</span>
</div>
<div class="h-1 w-full bg-slate-900 rounded-full overflow-hidden">
<div class="h-full bg-cyan-400 shadow-[0_0_8px_rgba(0,229,255,0.6)]" style="width: 14.2%"></div>
</div>
</div>
<div class="space-y-2">
<div class="flex justify-between items-end">
<label class="text-[10px] font-bold uppercase tracking-widest text-slate-400">Texture</label>
<span class="text-sm font-mono text-cyan-300">68.9%</span>
</div>
<div class="h-1 w-full bg-slate-900 rounded-full overflow-hidden">
<div class="h-full bg-cyan-400 shadow-[0_0_8px_rgba(0,229,255,0.6)]" style="width: 68.9%"></div>
</div>
</div>
<div class="space-y-2">
<div class="flex justify-between items-end">
<label class="text-[10px] font-bold uppercase tracking-widest text-slate-400">Volume</label>
<span class="text-sm font-mono text-cyan-300">4.21L</span>
</div>
<div class="h-1 w-full bg-slate-900 rounded-full overflow-hidden">
<div class="h-full bg-cyan-400 shadow-[0_0_8px_rgba(0,229,255,0.6)]" style="width: 82%"></div>
</div>
</div>
</div>
</div>
<div class="p-6 glass-panel glow-border rounded-xl flex flex-col items-center gap-4">
<h3 class="text-[10px] font-bold uppercase tracking-widest text-slate-400">AI Risk Assessment</h3>
<!-- Confidence Gauge -->
<div class="relative w-32 h-32 flex items-center justify-center">
<svg class="w-full h-full transform -rotate-90">
<circle class="text-slate-900" cx="64" cy="64" fill="transparent" r="58" stroke="currentColor" stroke-width="4"></circle>
<circle class="text-cyan-400 drop-shadow-[0_0_8px_rgba(0,229,255,0.4)]" cx="64" cy="64" fill="transparent" r="58" stroke="currentColor" stroke-dasharray="364.4" stroke-dashoffset="300" stroke-width="8"></circle>
</svg>
<div class="absolute inset-0 flex flex-col items-center justify-center">
<span class="text-3xl font-headline font-light text-on-surface">12%</span>
</div>
</div>
<div class="bg-cyan-500/10 px-4 py-1 rounded-full border border-cyan-400/30">
<span class="text-[10px] font-bold text-cyan-400 uppercase tracking-widest">Low Risk</span>
</div>
</div>
<div class="mt-auto">
<button class="w-full py-4 bg-primary-container text-on-primary-container font-headline font-bold rounded-lg shadow-[0_0_24px_rgba(0,229,255,0.3)] hover:scale-[1.02] transition-transform flex items-center justify-center gap-3">
<span class="material-symbols-outlined">description</span>
                        GENERATE CLINICAL REPORT
                    </button>
</div>
</aside>
</div>
<!-- Bottom Area: Slice Navigation & Telemetry -->
<footer class="h-48 bg-surface-container-lowest border-t border-white/5 flex items-stretch">
<div class="w-72 flex flex-col justify-center px-10 border-r border-white/5">
<p class="text-[10px] font-bold text-slate-500 uppercase tracking-[0.2em] mb-1">Live Telemetry</p>
<p class="font-headline text-xl text-cyan-400 font-light">P-8820 Pulse</p>
</div>
<div class="flex-1 px-8 py-4 flex flex-col justify-between">
<!-- Slices -->
<div class="flex gap-4 overflow-x-auto pb-2">
<div class="flex-shrink-0 w-24 h-24 rounded-lg overflow-hidden border-2 border-cyan-400 shadow-[0_0_12px_rgba(0,229,255,0.3)] cursor-pointer">
<img class="w-full h-full object-cover grayscale brightness-125" data-alt="monochrome medical scan slice of a lung with high contrast diagnostic markers" src="https://lh3.googleusercontent.com/aida-public/AB6AXuB5AUmTWD8CpdbFUrxcSwNb_KsyIRbwfld8CZPWGa7pe1wjepZYQHijko2gcESOC9y8GP_sv5js-tnNPeDgJBNekyoXpKPOEGg4-SlJJOIWy9y-eKqVbAqs-HKkDQsErWFifvCNKXCSUhMhp5UbUtT5nKPXpUilTM9xrnwbmfNtRjJ41tvGAL8w2bUjI6lwgCfRDj4qAxnYNwsG19sWyQvmOvrAPb5oULQObkJC9VpUB9R4P9MtnGSfjW2ZcuFY5mA1la4gYMt3uJ-9"/>
</div>
<div class="flex-shrink-0 w-24 h-24 rounded-lg overflow-hidden border border-white/10 opacity-50 hover:opacity-100 transition-opacity cursor-pointer">
<img class="w-full h-full object-cover grayscale brightness-125" data-alt="monochrome medical scan slice of a lung with high contrast diagnostic markers" src="https://lh3.googleusercontent.com/aida-public/AB6AXuDvig0GvLR8poBGHjy720Ew34PKvMgPvtIxwTp_3a2Am0rCzLUn4jYuUzpvbtHcpaDcGLi3F8w9gCovw2kF78VnCIO6RZndqPQHHj6-Wdc8TVpZXA8vMTX5PVbH6VUN_LJiwZ7PpQ3sZyjrxAWgMfTUMT0TjQpd3EQwundqj37V2UKJAZJVQ6te7eq3PoF8Vbym83_lz5lHCWpSy3VzCWKEUmzMcYzUTr6fUMN3gFoivdoabl-P9T3d7k7GRsppRQcWEGwwzYbdfvRN"/>
</div>
<div class="flex-shrink-0 w-24 h-24 rounded-lg overflow-hidden border border-white/10 opacity-50 hover:opacity-100 transition-opacity cursor-pointer">
<img class="w-full h-full object-cover grayscale brightness-125" data-alt="monochrome medical scan slice of a lung with high contrast diagnostic markers" src="https://lh3.googleusercontent.com/aida-public/AB6AXuAWyermIbJiHAdHftSlRDeI5qTf-9LQuZshjBwyWVYoXqG_Q7FYmg_f1UpirjDep_zjxm6YjUzJSvjECnucu3G_Dk2seRctmm8EzS_kLSXLH9bW7IQkuIq9l1Y81q5ZaJsv0V5w5o8LD6FWpQPjBj3dKZeMwy8ZxTp_RRVWRsF83ZMgEuLCxx-73egNAfiByqzrmbBhgCfMararRGFFl-rQ1LdZcNQADaAGrbqDYXwVvEc_c89gjSYNv-v8OWXVBCyt-XaSesxPFT9d"/>
</div>
<div class="flex-shrink-0 w-24 h-24 rounded-lg overflow-hidden border border-white/10 opacity-50 hover:opacity-100 transition-opacity cursor-pointer">
<img class="w-full h-full object-cover grayscale brightness-125" data-alt="monochrome medical scan slice of a lung with high contrast diagnostic markers" src="https://lh3.googleusercontent.com/aida-public/AB6AXuCmDPP9VySv0-upEDkcgtfq-_nus07fOB9h0QgpGS3ypVNRy_XvqXyHKaZXFx2V4hMvpBD8UpNUWKoy4aPWxjvP_fzEoa0q-Yuh0McWT4GQIL0356E-iGwa_NuatMjZUO6HX_jIFRJEP0si2Zh2sF2iL4pcxnWAd7-rPHf6TFBSL7aSj-I4zY97JMJCwBoapXXLLHwZ_m_yC0S2TRApryTAWok2tdRNU8jr2LcPX2LIQOuqs7ahUb_intp-G3ktdlNTlo8xrdVv5Vbe"/>
</div>
<div class="flex-shrink-0 w-24 h-24 rounded-lg overflow-hidden border border-white/10 opacity-50 hover:opacity-100 transition-opacity cursor-pointer">
<img class="w-full h-full object-cover grayscale brightness-125" data-alt="monochrome medical scan slice of a lung with high contrast diagnostic markers" src="https://lh3.googleusercontent.com/aida-public/AB6AXuCLQ-P19M9mfgtPrAV-6DnaYEVF6r3-UIm9eDd6LfQrS6fUCaPy-JqL_gsikqJzMaxplzW8uoEFXISFTfPo74l7CYOzJSsJ1gMVn6tin1dZKhRmQMBqP5qz2Mj8KMvEj3wlDzaSnu46gxNw4xp8WNXGOVV_pczxGEsn3pR7BvyZyjsEthhQ1A3xGojvMO_WPNYN7TyIRBXa3nlBv7MxkvlQ4IcFIu0AnMcQugLkYw8TXLTJdSG4-SnHl5Wjj3ePXbWdLua0SLaCFg-X"/>
</div>
<div class="flex-shrink-0 w-24 h-24 rounded-lg overflow-hidden border border-white/10 opacity-50 hover:opacity-100 transition-opacity cursor-pointer">
<img class="w-full h-full object-cover grayscale brightness-125" data-alt="monochrome medical scan slice of a lung with high contrast diagnostic markers" src="https://lh3.googleusercontent.com/aida-public/AB6AXuCEB1ekR2jmEPXhoULIx6nWBfdiP-jx5XnIRMWxdTcBKpct1OPud6CAHq4o4xSEcLBVCgI-Z2aeeKdY1raTEdV7muusenFL6nSSlhct9_QNOI3_r6FKgPG3z1Hkjx3gYUnYUA5KOA0GoiAIzTm7kTK-dye-X7jbqZnUY7ZnNsyxENwMbpuXZPmJ63poShO92w03DCPRuB9OqmJR1hIWQBBH763pkswvGrVnIp54zxaaLGSDiFa9wM1dtu8SM-403mqtCyhBx4-W9Jdi"/>
</div>
</div>
</div>
<div class="w-[400px] p-6 flex flex-col justify-center border-l border-white/5">
<!-- Telemetry Line Chart -->
<div class="h-16 flex items-end gap-1 px-4">
<div class="flex-1 bg-cyan-400/40" style="height: 40%"></div>
<div class="flex-1 bg-cyan-400/60" style="height: 60%"></div>
<div class="flex-1 bg-cyan-400" style="height: 80%"></div>
<div class="flex-1 bg-cyan-400/50" style="height: 55%"></div>
<div class="flex-1 bg-cyan-400/70" style="height: 70%"></div>
<div class="flex-1 bg-cyan-400" style="height: 90%"></div>
<div class="flex-1 bg-cyan-400/30" style="height: 35%"></div>
<div class="flex-1 bg-cyan-400/60" style="height: 65%"></div>
<div class="flex-1 bg-cyan-400/80" style="height: 75%"></div>
<div class="flex-1 bg-cyan-400" style="height: 95%"></div>
</div>
<div class="flex justify-between px-4 mt-2">
<span class="text-[8px] text-slate-500 uppercase">Analysis Load</span>
<span class="text-[8px] text-cyan-400 uppercase font-bold">98.2% Optimal</span>
</div>
</div>
</footer>
</main>
</body></html>