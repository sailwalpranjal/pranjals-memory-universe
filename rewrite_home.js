const fs = require('fs');
let code = fs.readFileSync('src/app/page.tsx', 'utf-8');

code = code.replace(
  '<div className="absolute inset-0 grid grid-cols-3 md:grid-cols-6 gap-0.5 opacity-20">',
  '<div className="absolute inset-0 grid grid-cols-2 md:grid-cols-4 lg:grid-cols-8 gap-0 opacity-15 mix-blend-screen pointer-events-none">'
);
code = code.replace(
  'const now = new Date();',
  `const [visitorMode, setVisitorMode] = useState<string | null>(null);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const mode = localStorage.getItem('pranjal_visitor_mode');
      if (mode) setVisitorMode(mode);
    }
  }, []);

  const toggleVisitorMode = () => {
    if (visitorMode) {
      localStorage.removeItem('pranjal_visitor_mode');
      setVisitorMode(null);
      window.location.reload();
    } else {
      const personId = window.prompt('Enter Friend ID for Restricted Mode:');
      if (personId) {
        localStorage.setItem('pranjal_visitor_mode', personId);
        setVisitorMode(personId);
        window.location.reload();
      }
    }
  };

  const now = new Date();`
);

code = code.replace(
  'Pranjal&apos;s Universe',
  `<div className="relative group">
    <div className="absolute -inset-2 bg-gradient-to-r from-primary/20 to-blue-500/20 blur-2xl rounded-full opacity-0 group-hover:opacity-100 transition-opacity duration-1000" />
    <span className="font-bold bg-clip-text text-transparent bg-gradient-to-r from-white to-gray-400">Memory</span> Universe
  </div>`
);

code = code.replace(
  `{greeting}`,
  `{greeting}, {visitorMode ? 'Friend' : 'Pranjal'}`
);

// Add the button
code = code.replace(
  '<div className="inline-flex items-center space-x-2 px-3 py-1 rounded-full bg-white/5 border border-white/10 text-[10px] font-mono tracking-widest text-muted-foreground uppercase">',
  `<div className="flex flex-col md:flex-row items-center gap-3">
    <div className="inline-flex items-center space-x-2 px-4 py-1.5 rounded-full bg-white/5 border border-white/10 text-[10px] font-mono tracking-widest text-muted-foreground uppercase shadow-2xl backdrop-blur-md">
      <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse shadow-[0_0_10px_rgba(52,211,153,0.5)]" />
      <span>Pranjal's Network</span>
      <span className="text-white/20">|</span>
      <span className="text-emerald-400">Sync Active</span>
    </div>
    <button 
      onClick={toggleVisitorMode}
      className={\`inline-flex items-center space-x-2 px-4 py-1.5 rounded-full border text-[10px] font-mono tracking-widest uppercase shadow-2xl backdrop-blur-md transition-all \${visitorMode ? 'bg-amber-500/10 border-amber-500/30 text-amber-500' : 'bg-white/5 border-white/10 text-muted-foreground hover:bg-white/10'}\`}
    >
      <span>{visitorMode ? 'Visitor Restricted Mode' : 'Admin Access'}</span>
    </button>
  </div>
  <!-- hide old --> <div className="hidden">`
);
code = code.replace(
  '<span className="text-emerald-400">Cloud Sync Ready</span>\n          </div>',
  '</div>'
);

fs.writeFileSync('src/app/page.tsx', code);
