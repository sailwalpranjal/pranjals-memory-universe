import re

with open("src/app/make/page.tsx", "r", encoding="utf-8") as f:
    content = f.read()

# 1. Remove the Inline Frame Inspector
inline_inspector_pattern = re.compile(
    r'\s*{\/\* Individual Frame Inspector & Precision Crop \*\/}.*?{/\* Select Memories Strip \*/}',
    re.DOTALL
)
content = inline_inspector_pattern.sub(r'\n\n          {/* Select Memories Strip */}', content)


# 2. Update the Select Memories Strip
select_strip_pattern = re.compile(
    r'(<div className="grid grid-cols-4 gap-2 max-h-48 overflow-y-auto p-1">.*?)(?=\s*</div>\s*\)})',
    re.DOTALL
)
def replace_select_strip(match):
    original = match.group(1)
    new = original.replace(
        'grid grid-cols-4 gap-2 max-h-48 overflow-y-auto p-1',
        'flex overflow-x-auto gap-3 pb-2 snap-x scrollbar-thin scrollbar-thumb-white/10'
    ).replace(
        'relative aspect-square rounded-xl overflow-hidden cursor-pointer border transition-all',
        'relative w-20 h-20 shrink-0 snap-start rounded-xl overflow-hidden cursor-pointer border transition-all'
    ).replace(
        '<img src={p.url} alt="" className="w-full h-full object-cover" />',
        '<img src={p.url} alt="" className="w-full h-full object-cover" draggable={false} />'
    )
    return new
content = select_strip_pattern.sub(replace_select_strip, content)


# 3. Add onClick to deselect on the canvas preview wrapper
preview_wrapper_pattern = re.compile(r'(<div className="flex-1 w-full overflow-hidden flex items-center justify-center relative")')
content = preview_wrapper_pattern.sub(r'\1 onClick={() => setActivePhotoId(null)}', content)


# 4. Add drag events to all the wrappers of images on canvas
# Specifically look for onClick={() => setActivePhotoId(p.id)} and selectedPhotos[0].id

def add_pointer_events(match):
    original = match.group(0)
    photo_id = "p.id"
    if "selectedPhotos[0].id" in original:
        photo_id = "selectedPhotos[0].id"
        
    return original.replace(
        f'onClick={{() => setActivePhotoId({photo_id})}}',
        f'onPointerDown={{(e) => handlePointerDown(e, {photo_id})}}\n                        onPointerMove={{(e) => handlePointerMove(e, {photo_id})}}\n                        onPointerUp={{handlePointerUp}}\n                        onPointerCancel={{handlePointerUp}}\n                        onClick={{(e) => {{ e.stopPropagation(); setActivePhotoId({photo_id}); }}}}'
    )

content = re.sub(
    r'onClick=\{\(\) => setActivePhotoId\([^)]+\)\}',
    add_pointer_events,
    content
)

# 5. Append the Floating Frame Inspector
floating_inspector = """
      {/* ── Frame Inspector Overhaul (Floating) ───────────────── */}
      {activePhotoId && selectedPhotos.length > 0 && (
        <div className="fixed bottom-0 inset-x-0 rounded-t-3xl md:rounded-3xl md:bottom-6 md:right-6 md:left-auto md:w-[340px] bg-zinc-900/95 border border-white/10 shadow-2xl p-5 z-50 backdrop-blur-xl animate-fade-in max-h-[85vh] overflow-y-auto">
          <div className="flex items-center justify-between mb-4">
            <div className="flex flex-col">
              <span className="text-xs font-medium text-primary uppercase tracking-widest flex items-center space-x-1.5">
                <Crop className="w-3.5 h-3.5" />
                <span>Frame Inspector</span>
              </span>
              <span className="text-[10px] text-muted-foreground font-mono mt-1">
                {`Frame ${selectedPhotos.findIndex((p) => p.id === activePhotoId) + 1} of ${selectedPhotos.length}`}
              </span>
            </div>
            <button
              onClick={() => setActivePhotoId(null)}
              className="p-1.5 bg-white/5 hover:bg-white/10 rounded-full transition-colors"
            >
              <X className="w-4 h-4 text-muted-foreground hover:text-white" />
            </button>
          </div>

          <div className="space-y-4 pt-2 border-t border-white/5 text-xs">
            {/* Zoom / Scale */}
            <div className="space-y-1">
              <div className="flex justify-between text-[11px] text-muted-foreground">
                <span className="flex items-center gap-1">
                  <ZoomIn className="w-3 h-3" />
                  <span>Zoom / Frame Crop</span>
                </span>
                <span className="font-mono">{getAdjustment(activePhotoId).zoom.toFixed(1)}x</span>
              </div>
              <input
                type="range"
                min="1"
                max="2.5"
                step="0.05"
                value={getAdjustment(activePhotoId).zoom}
                onChange={(e) => updateActiveAdjustment({ zoom: parseFloat(e.target.value) })}
                className="w-full accent-primary h-1.5 bg-white/10 rounded-lg cursor-pointer"
              />
            </div>

            {/* Individual Rotation */}
            <div className="space-y-1">
              <div className="flex justify-between text-[11px] text-muted-foreground">
                <span className="flex items-center gap-1">
                  <RotateCw className="w-3 h-3" />
                  <span>Frame Rotation</span>
                </span>
                <span className="font-mono">{getAdjustment(activePhotoId).rotation}°</span>
              </div>
              <input
                type="range"
                min="-45"
                max="45"
                step="1"
                value={getAdjustment(activePhotoId).rotation}
                onChange={(e) => updateActiveAdjustment({ rotation: parseInt(e.target.value) })}
                className="w-full accent-primary h-1.5 bg-white/10 rounded-lg cursor-pointer"
              />
            </div>

            {/* Polaroid Note / Custom Caption */}
            <div className="space-y-1 pt-1">
              <label className="text-[10px] text-muted-foreground uppercase tracking-wider font-medium">
                Frame Caption / Polaroid Note
              </label>
              <input
                type="text"
                value={getAdjustment(activePhotoId).polaroidCaption || ""}
                onChange={(e) => updateActiveAdjustment({ polaroidCaption: e.target.value })}
                placeholder="Handwritten note e.g. 'Golden hour in Shibuya'..."
                className="w-full px-3 py-1.5 bg-black/40 border border-white/10 rounded-xl text-xs text-foreground outline-none focus:border-primary/50"
              />
            </div>

            {/* Individual Filter Presets */}
            <div className="space-y-1 pt-1">
              <label className="text-[10px] text-muted-foreground uppercase tracking-wider font-medium">
                Frame Color Grade
              </label>
              <div className="flex flex-wrap gap-1">
                {[
                  { id: "none", label: "Natural" },
                  { id: "bw", label: "B&W Mono" },
                  { id: "vintage", label: "Vintage 70s" },
                  { id: "vibrant", label: "Vivid" },
                  { id: "cool", label: "Cool Wave" },
                ].map((preset) => (
                  <button
                    key={preset.id}
                    onClick={() => updateActiveAdjustment({ filterPreset: preset.id as "none" | "bw" | "vintage" | "vibrant" | "cool" })}
                    className={`px-2 py-0.5 rounded-lg text-[10px] font-mono border transition-all ${
                      getAdjustment(activePhotoId).filterPreset === preset.id
                        ? "bg-primary/20 text-primary border-primary/50"
                        : "bg-white/5 text-muted-foreground border-white/5 hover:text-white"
                    }`}
                  >
                    {preset.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Reset Frame Button */}
            <button
              onClick={() =>
                updateActiveAdjustment({
                  zoom: 1,
                  rotation: 0,
                  panX: 0,
                  panY: 0,
                  polaroidCaption: "",
                  filterPreset: "none",
                })
              }
              className="w-full py-1.5 mt-2 text-[10px] text-muted-foreground hover:text-foreground border border-white/5 rounded-xl hover:bg-white/5 transition-colors"
            >
              Reset Frame Adjustments
            </button>
          </div>
        </div>
      )}
"""
content = content.replace("    </main>\n  );\n}", floating_inspector + "\n    </main>\n  );\n}")

with open("src/app/make/page.tsx", "w", encoding="utf-8") as f:
    f.write(content)

print("Replaced successfully!")
