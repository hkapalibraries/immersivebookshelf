import { useRef, useEffect } from "react";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { Environment, OrbitControls, CameraControls, ContactShadows } from "@react-three/drei";
import * as THREE from "three";
import { BookData } from "../types";
import { BookNode } from "./BookNode";

interface LibrarySceneProps {
  books: BookData[];
  onSelectBook: (book: BookData) => void;
  selectedBook: BookData | null;
  autoRotate: boolean;
  onInteract: () => void;
}

function RotatingShelf({ books, onSelectBook, isPaused }: { books: BookData[], onSelectBook: any, isPaused: boolean }) {
  const groupRef = useRef<THREE.Group>(null);

  useFrame((state, delta) => {
    if (groupRef.current && !isPaused) {
      groupRef.current.rotation.y += delta * 0.15; // slow continuous rotation
    }
  });

  const radius = 6;
  const heightSpacing = 2.8;
  const booksPerRow = 16;
  const totalRows = Math.ceil(books.length / booksPerRow);

  // We can also create physical shelves
  const shelves = [];
  const startY = -((totalRows - 1) * heightSpacing) / 2;

  // Add a base floor for the shelf
  for (let i = 0; i < totalRows + 1; i++) {
    shelves.push(
      <mesh key={`shelf-${i}`} position={[0, startY + i * heightSpacing - 1.25, 0]} receiveShadow castShadow>
        <cylinderGeometry args={[radius + 0.3, radius + 0.3, 0.1, 64]} />
        <meshStandardMaterial color="#8b5a2b" roughness={0.8} />
      </mesh>
    );
  }

  // Central pillar
  const pillarHeight = totalRows * heightSpacing;
  shelves.push(
    <mesh key="pillar" position={[0, 0, 0]} receiveShadow castShadow>
      <cylinderGeometry args={[radius - 1.2, radius - 1.2, pillarHeight, 32]} />
      <meshStandardMaterial color="#5c3a21" roughness={0.9} />
    </mesh>
  );

  return (
    <group ref={groupRef}>
      {shelves}
      {books.map((book, i) => {
         const row = Math.floor(i / booksPerRow);
         const col = i % booksPerRow;
         const angle = (col / booksPerRow) * Math.PI * 2;
         
         const x = Math.sin(angle) * radius;
         const z = Math.cos(angle) * radius;
         const y = startY + row * heightSpacing;

         // angle + Math.PI would face inwards. angle makes it face outwards.
         const rotationY = angle;

         return (
            <group key={i} position={[x, y, z]} rotation={[0, rotationY, 0]}>
              <BookNode
                index={i}
                book={book}
                position={[0, 0, 0]}
                rotation={[0, 0, 0]}
                onClick={onSelectBook}
              />
            </group>
         );
      })}
    </group>
  );
}

function SceneContents({ books, onSelectBook, selectedBook, autoRotate, onInteract }: LibrarySceneProps) {
  const controlsRef = useRef<CameraControls>(null);

  // Initialize the camera pivot/target to the central axis of the bookshelf.
  // This makes all orbiting (left-drag rotate, rotate buttons) turn around the pillar (軸心轉)
  // instead of an arbitrary point or the last focused book.
  useEffect(() => {
    const timer = setTimeout(() => {
      if (controlsRef.current) {
        controlsRef.current.setTarget(0, 2.0, 0, false);
      }
    }, 120);
    return () => clearTimeout(timer);
  }, []);

  const handleBookClick = (book: BookData, position: THREE.Vector3) => {
    onInteract();
    onSelectBook(book);
    if (controlsRef.current) {
      const controls = controlsRef.current;

      // === 軸心轉 (pivot / orbit around shelf center) ===
      // Instead of flying the camera close to one book (which translates/pans the whole view),
      // we keep the orbit target fixed at the central axis of the bookshelf.
      // Then we place the camera on a circle around the center at the book's radial angle.
      // This gives a consistent "turntable" / axis rotation feel. Left-drag will now orbit around the pillar.
      const centerY = 2.0; // fixed vertical pivot for the whole shelf (middle height)
      controls.setTarget(0, centerY, 0, false);

      // Compute the book's current world angle (this accounts for any current shelf group rotation)
      const bookAngle = Math.atan2(position.x, position.z);

      // Viewing distance from center (shelf radius ~6, so this puts camera outside looking in)
      const focusDist = 10.5;
      const camX = Math.sin(bookAngle) * focusDist;
      const camZ = Math.cos(bookAngle) * focusDist;
      const camY = position.y + 0.9; // slightly above the book's row for nice framing of the cover

      // Move camera to the new position while always looking at the central pivot.
      // Future rotates (mouse or buttons) will orbit around (0, centerY, 0)
      controls.setLookAt(
        camX, camY, camZ,
        0, centerY, 0,
        true // animate
      );
    }
  };

  useEffect(() => {
    // We intentionally do not reset the camera position when selectedBook becomes null
    // so the user stays exactly where they were looking when they closed the book.
  }, [selectedBook]);

  useEffect(() => {
    const handleCameraControl = (e: Event) => {
      onInteract();
      const customEvent = e as CustomEvent<string>;
      const controls = controlsRef.current;
      if (!controls) return;

      const transition = true;
      switch (customEvent.detail) {
        case 'zoom-in': controls.dolly(4, transition); break;
        case 'zoom-out': controls.dolly(-4, transition); break;
        case 'rotate-left': controls.rotate(-Math.PI / 6, 0, transition); break;
        case 'rotate-right': controls.rotate(Math.PI / 6, 0, transition); break;
        case 'move-up': controls.elevate(2.8, transition); break;
        case 'move-down': controls.elevate(-2.8, transition); break;
      }
    };

    window.addEventListener('camera-control', handleCameraControl);
    return () => window.removeEventListener('camera-control', handleCameraControl);
  }, [onInteract]);

  return (
    <>
      <CameraControls 
        ref={controlsRef} 
        makeDefault 
        minDistance={5} 
        maxDistance={40} 
        minPolarAngle={Math.PI / 6}
        maxPolarAngle={Math.PI / 2 + 0.1}
        mouseButtons={{
          left: 1,  // ROTATE (軸心轉 / orbit around the shelf center target)
          right: 2, // TRUCK (pan / 平移)
          middle: 16, // DOLLY
          wheel: 16, // DOLLY
        }}
        touches={{
          one: 1,   // primary one-finger drag now rotates (軸心轉) like left mouse
          two: 32768, // two-finger dolly + rotate
          three: 0
        }}
        onChange={(e) => {
           // Trapping interact
        }}
      />
      
      <ambientLight intensity={0.7} color="#ffffff" />
      <directionalLight position={[10, 20, 15]} intensity={1.5} castShadow shadow-mapSize={[2048, 2048]} />
      <pointLight position={[-10, 5, -10]} intensity={1.0} color="#f5ecd5" />
      
      <Environment preset="apartment" />

      <group position={[0, 0, 0]} onPointerDown={onInteract}>
         <RotatingShelf books={books} onSelectBook={handleBookClick} isPaused={!!selectedBook || !autoRotate} />
         
         <ContactShadows 
           resolution={1024} 
           scale={30} 
           blur={2} 
           opacity={0.3} 
           far={10} 
           color="#000000" 
           position={[0, -((Math.ceil(books.length / 16) * 2.8) / 2) - 0.1, 0]} 
         />
      </group>
    </>
  );
}

export function LibraryScene(props: LibrarySceneProps) {
  return (
    <Canvas 
       shadows 
       camera={{ position: [0, 5, 25], fov: 45 }} 
       gl={{ alpha: true }}
       onPointerDown={props.onInteract}
       onWheel={props.onInteract}
    >
      <fog attach="fog" args={["#f4efe6", 20, 60]} />
      <SceneContents {...props} />
    </Canvas>
  );
}
