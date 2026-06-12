import * as THREE from "three";
import { useState, useRef, useMemo, useEffect } from "react";
import { Text, useCursor } from "@react-three/drei";
import { BookData } from "../types";

interface BookNodeProps {
  book: BookData;
  position: [number, number, number];
  rotation: [number, number, number];
  onClick: (book: BookData, position: THREE.Vector3) => void;
  index: number;
}

const colorPalette = [
  "#2C363F",
  "#E75A7C",
  "#F2F5EA",
  "#D6E3F8",
  "#A3C4BC",
  "#E0E2DB",
  "#D2D4C8",
  "#5B6C5D",
  "#3A433A",
  "#2A3029"
];

function stringToColor(str: string) {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = str.charCodeAt(i) + ((hash << 5) - hash);
  }
  const index = Math.abs(hash) % colorPalette.length;
  return colorPalette[index];
}

export function BookNode({ book, position, rotation, onClick, index }: BookNodeProps) {
  const meshRef = useRef<THREE.Group>(null);
  const [hovered, setHovered] = useState(false);
  const [coverTexture, setCoverTexture] = useState<THREE.Texture | null>(null);
  
  useCursor(hovered);

  const bookColor = useMemo(() => stringToColor(book.Title), [book.Title]);
  const textColor = ["#F2F5EA", "#D6E3F8", "#E0E2DB", "#D2D4C8", "#E3EEF1", "#A3C4BC"].includes(bookColor) ? "#111" : "#fff";

  const titleText = book.Title || "Unknown Title";
  // Adaptive font size + conservative maxWidth/lineHeight so long titles (e.g. the 2006.07 season one)
  // never overflow the book face (1.5 x 2.2). We leave generous margins on all sides.
  const fontSize = (() => {
    const len = titleText.length;
    if (len > 80) return 0.085;
    if (len > 55) return 0.095;
    if (len > 40) return 0.105;
    if (len > 25) return 0.115;
    return 0.125;
  })();

  const hasCoverUrl = book.cover && book.cover.trim() !== "";

  // Helper to detect if a loaded texture is "tainted" (CORS issue).
  // Even if the HTTP request succeeds and onLoad fires, without proper
  // Access-Control-Allow-Origin the WebGL texture will render black.
  function isTextureTainted(texture: THREE.Texture): boolean {
    try {
      const img = texture.image;
      if (!img || !(img instanceof HTMLImageElement)) {
        return false;
      }
      const canvas = document.createElement("canvas");
      canvas.width = Math.min(4, img.naturalWidth || img.width || 4);
      canvas.height = Math.min(4, img.naturalHeight || img.height || 4);
      const ctx = canvas.getContext("2d", { willReadFrequently: true });
      if (!ctx) return false;
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
      ctx.getImageData(0, 0, 1, 1); // throws SecurityError if tainted
      return false;
    } catch (e: any) {
      const msg = String(e?.message || e || "");
      if (e?.name === "SecurityError" || /tainted|cross-origin|security/i.test(msg)) {
        return true;
      }
      return false;
    }
  }

  useEffect(() => {
    if (!hasCoverUrl) return;

    let cancelled = false;

    // Detect iOS (iPhone / iPad / iPadOS 13+) to reorder strategies.
    // iOS Safari is much stricter with WebGL CORS than desktop browsers.
    const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) ||
                  (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);

    // Robust cover loading with fallback:
    // Desktop: direct → corsproxy.io → allorigins
    // iOS:   corsproxy.io (優先) → allorigins → direct (最後)
    // We still verify after every load that the texture is not tainted.
    const loadCoverTexture = async () => {
      const originalUrl = book.cover!.trim();

      // On iOS we put corsproxy.io first because iOS Safari often blocks direct loads.
      const strategies: Array<{ label: string; getUrl: (u: string) => string } | null> = isIOS
        ? [
            { label: "corsproxy.io", getUrl: (u) => `https://corsproxy.io/?${encodeURIComponent(u)}` },
            { label: "allorigins", getUrl: (u) => `https://api.allorigins.win/raw?url=${encodeURIComponent(u)}` },
            null, // direct last on iOS
          ]
        : [
            null, // direct first on desktop
            { label: "corsproxy.io", getUrl: (u) => `https://corsproxy.io/?${encodeURIComponent(u)}` },
            { label: "allorigins", getUrl: (u) => `https://api.allorigins.win/raw?url=${encodeURIComponent(u)}` },
          ];

      for (const strategy of strategies) {
        const urlToLoad = strategy ? strategy.getUrl(originalUrl) : originalUrl;
        const method = strategy ? `via ${strategy.label}` : "direct";

        console.log(`[BookNode] Trying cover for "${book.Title}" ${method}: ${urlToLoad}`);

        try {
          const loader = new THREE.TextureLoader();
          loader.setCrossOrigin("anonymous");

          const texture = await new Promise<THREE.Texture>((resolve, reject) => {
            loader.load(
              urlToLoad,
              (tex) => {
                tex.colorSpace = THREE.SRGBColorSpace;
                tex.flipY = false;

                // Correct vertical inversion ("倒轉了上下") that is common with web-hosted covers (ImgBB etc.)
                // Using repeat.y = -1 flips only top<->bottom without introducing horizontal mirror (unlike 180° rotation).
                // If it ends up left-right mirrored ("鏡面"), we can also do repeat.x = -1.
                tex.wrapS = THREE.RepeatWrapping;
                tex.wrapT = THREE.RepeatWrapping;
                tex.repeat.set(1, -1);
                tex.center.set(0.5, 0.5);
                tex.needsUpdate = true; // ensure WebGL uploads the texture + transform

                // Critical check: if direct load succeeded but image is CORS-tainted,
                // the texture will be black in the 3D scene. Treat it as failure and try proxy.
                if (isTextureTainted(tex)) {
                  tex.dispose();
                  reject(new Error("Texture is tainted (image host did not send CORS headers)"));
                  return;
                }

                resolve(tex);
              },
              undefined,
              (err) => reject(err)
            );
          });

          if (cancelled) return;

          const w = texture.image?.naturalWidth || texture.image?.width || '?';
          const h = texture.image?.naturalHeight || texture.image?.height || '?';
          console.log(`[BookNode] ✅ Successfully loaded cover for "${book.Title}" (${method}): ${urlToLoad}`);
          console.log(`[BookNode]    → image size: ${w}×${h}`);
          setCoverTexture(texture);
          return; // success — stop trying other strategies
        } catch (err) {
          console.warn(`[BookNode] ❌ ${method} failed for "${book.Title}":`, err);
          // continue to next strategy
        }
      }

      if (!cancelled) {
        console.error(`[BookNode] All strategies failed for cover of "${book.Title}". Falling back to solid color + title.`);
      }
    };

    loadCoverTexture();

    return () => {
      cancelled = true;
    };
  }, [book.cover, hasCoverUrl]);

  // Debug: confirm whether the local state actually receives the texture
  useEffect(() => {
    if (coverTexture) {
      console.log(`[BookNode] coverTexture STATE UPDATED for index=${index} "${book.Title}" — the 3D cover material should now switch to the image (and title text should disappear)`);
    }
  }, [coverTexture, book.Title, index]);

  // Imperative fallback: force the texture onto material-4 of the actual THREE.Mesh.
  // This helps in cases where the declarative attach material prop update doesn't immediately
  // reflect in the rendered 3D scene (common with dynamic textures + multi-materials in R3F dev).
  useEffect(() => {
    if (!coverTexture || !meshRef.current) return;

    let applied = false;
    meshRef.current.traverse((child) => {
      if (child instanceof THREE.Mesh && !applied) {
        const mats = child.material;
        if (Array.isArray(mats) && mats.length > 4) {
          const mat = mats[4] as THREE.MeshStandardMaterial;
          if (mat) {
            mat.map = coverTexture;
            if (mat.map) {
              mat.map.flipY = false;

              // Same vertical correction (repeat.y=-1) applied imperatively for robustness
              // after the texture is assigned to the material.
              mat.map.wrapS = THREE.RepeatWrapping;
              mat.map.wrapT = THREE.RepeatWrapping;
              mat.map.repeat.set(1, -1);
              mat.map.center.set(0.5, 0.5);
              mat.map.needsUpdate = true;
            }
            mat.color.set(0xffffff);
            mat.roughness = 0.5;
            mat.metalness = 0;
            mat.side = THREE.FrontSide;
            mat.needsUpdate = true;
            applied = true;
            console.log(`[BookNode] Imperatively applied texture to material-4 for index=${index} "${book.Title}"`);
          }
        }
      }
    });
  }, [coverTexture, book.Title, index]);

  // Dispose texture when this BookNode unmounts (or when texture is replaced)
  useEffect(() => {
    return () => {
      if (coverTexture) {
        try { coverTexture.dispose(); } catch {}
      }
    };
  }, [coverTexture]);

  const emissiveColor = hovered ? new THREE.Color(bookColor).multiplyScalar(0.5) : new THREE.Color(0x000000);

  // One-time diagnostic: did the BookNode that received a coverTexture actually re-render with it?
  const renderLoggedRef = useRef(false);
  if (coverTexture && !renderLoggedRef.current) {
    console.log(`[BookNode] RENDER branch with coverTexture=true (index=${index}) title="${book.Title}" — Text should be hidden, material-4 should have map`);
    renderLoggedRef.current = true;
  }

  return (
    <group 
      ref={meshRef} 
      position={position} 
      rotation={rotation}
      onClick={(e) => {
        e.stopPropagation();
        if (meshRef.current) {
          const worldPos = new THREE.Vector3();
          meshRef.current.getWorldPosition(worldPos);
          onClick(book, worldPos);
        }
      }}
      onPointerOver={(e) => { e.stopPropagation(); setHovered(true); }}
      onPointerOut={(e) => { e.stopPropagation(); setHovered(false); }}
    >
      <mesh position={[0, 0, 0]} castShadow receiveShadow>
        {/* Book shape */}
        <boxGeometry args={[1.5, 2.2, 0.2]} />
        <meshStandardMaterial attach="material-0" color={bookColor} roughness={0.7} metalness={0.1} emissive={emissiveColor} />
        <meshStandardMaterial attach="material-1" color={bookColor} roughness={0.7} metalness={0.1} emissive={emissiveColor} />
        <meshStandardMaterial attach="material-2" color={bookColor} roughness={0.7} metalness={0.1} emissive={emissiveColor} />
        <meshStandardMaterial attach="material-3" color={bookColor} roughness={0.7} metalness={0.1} emissive={emissiveColor} />
        
        {/* Always render the same material slot for stability in R3F.
            When coverTexture is present we use the map + white tint; otherwise solid bookColor.
            This avoids conditional material elements which can fail to update the mesh. */}
        <meshStandardMaterial 
          attach="material-4" 
          map={coverTexture || undefined} 
          color={coverTexture ? 0xffffff : bookColor} 
          roughness={coverTexture ? 0.5 : 0.7} 
          metalness={coverTexture ? 0 : 0.1}
          side={THREE.FrontSide}
          emissive={coverTexture 
            ? (hovered ? new THREE.Color("#444") : new THREE.Color(0x000000)) 
            : emissiveColor} 
        />
        
        <meshStandardMaterial attach="material-5" color={bookColor} roughness={0.7} metalness={0.1} emissive={emissiveColor} />
      </mesh>
      
      {/* Fallback Title Text if no cover image is provided (only when we don't have a good texture) */}
      {!coverTexture && (
        <Text
          position={[0, 0, 0.11]}
          fontSize={fontSize}
          color={textColor}
          anchorX="center"
          anchorY="middle"
          maxWidth={1.22}
          textAlign="center"
          lineHeight={1.1}
          font="https://fonts.gstatic.com/s/inter/v12/UcCO3FwrK3iLTeHuS_fvQtMwCp50KnMw2boKoduKmMEVuLyfMZhrib2Bg-4.ttf"
        >
          {titleText}
        </Text>
      )}
    </group>
  );
}
