document.addEventListener('DOMContentLoaded', () => {
    const canvas = document.getElementById('grass-canvas');
    const ctx = canvas.getContext('2d');

    if (!canvas || !ctx) {
        console.error("Error: Canvas element or context not found!");
        return;
    }

    let width = canvas.width = window.innerWidth;
    let height = canvas.height = window.innerHeight;
    let blades = [];

    // --- Zoom & Viewport --- 
    const zoomLevel = 2.5; // <<< Set zoom level (e.g., 2.5x)
    let viewX = 0; // Top-left corner of the visible world area (for culling)
    let viewY = 0;
    let viewWidth = width / zoomLevel;
    let viewHeight = height / zoomLevel;

    // --- Interaction Variables --- 
    const interactionRadius = 60 / zoomLevel; // Adjust radius for world coordinates
    const maxRotation = 70;
    const scaleFactor = 0.9;
    let worldMouseX = -interactionRadius * 2;
    let worldMouseY = -interactionRadius * 2;
    let mouseX = width / 2;
    let mouseY = height / 2;

    // --- Blade Generation Function ---
    function generateBlades() {
        blades = []; 
        const bladeCount = calculateBladeCount(); 
        console.log(`Generating ${bladeCount} blades`);
                
        for (let i = 0; i < bladeCount; i++) {
            // Appearance (Adjusted for wider, shorter, more varied blades)
            const bladeHeight = 35 + Math.random() * 25; // Shorter: 35px to 60px
            const bladeWidth = 5 + Math.random() * 5;   // Wider: 5px to 10px
            const hueVariation = (Math.random() - 0.5) * 25; // More hue variation
            const lightnessVariation = Math.random() * 25; // More lightness variation
            const color1 = `hsl(${115 + hueVariation}, 65%, ${30 + lightnessVariation}%)`; // Adjusted base lightness
            const color2 = `hsl(${120 + hueVariation}, 55%, ${50 + lightnessVariation}%)`; // Adjusted tip lightness
            
            // Position (Still within original world dimensions)
            const x = Math.random() * width;
            const y = Math.random() * height;
            const initialRotation = (Math.random() - 0.5) * 20;

            blades.push({ 
                x: x, y: y, w: bladeWidth, h: bladeHeight,
                color1: color1, color2: color2,
                initialRotation: initialRotation,
                currentRotation: initialRotation, 
                scale: 1
            });
        }
        blades.sort((a, b) => a.y - b.y);
    }

    // --- Update and Draw Loop ---
    function updateAndDraw() {
        // Calculate zoom offsets to keep zoom centered
        const offsetX = (width / 2) * (1 - zoomLevel);
        const offsetY = (height / 2) * (1 - zoomLevel);

        // Calculate the top-left corner of the visible world area more clearly
        const visibleWorldWidth = width / zoomLevel;
        const visibleWorldHeight = height / zoomLevel;
        // World coordinate of the left edge of the viewport
        viewX = (width - visibleWorldWidth) / 2; 
        // World coordinate of the top edge of the viewport
        viewY = (height - visibleWorldHeight) / 2;
        viewWidth = visibleWorldWidth; // Assign for clarity/use in culling
        viewHeight = visibleWorldHeight;

        // Convert screen mouse coords to world mouse coords
        worldMouseX = (mouseX - offsetX) / zoomLevel;
        worldMouseY = (mouseY - offsetY) / zoomLevel;
        // Add console log for debugging coords
        // console.log(`Screen: ${mouseX.toFixed(0)},${mouseY.toFixed(0)} | World: ${worldMouseX.toFixed(0)},${worldMouseY.toFixed(0)} | View: ${viewX.toFixed(0)},${viewY.toFixed(0)}`);

        // Clear canvas
        ctx.clearRect(0, 0, width, height);

        // Apply zoom and center transform
        ctx.save();
        // Order matters: Translate so world origin (0,0) maps to screen (offsetX, offsetY), then scale
        ctx.translate(offsetX, offsetY); 
        ctx.scale(zoomLevel, zoomLevel);
        

        // Cull and draw visible blades
        let visibleCount = 0;
        blades.forEach(blade => {
            // TEMPORARILY DISABLE CULLING CHECK FOR DEBUGGING:
            // Check if blade *base* is roughly within the extended view for interaction
            // <<< RE-ENABLE Outer Culling Check >>>
            if (blade.x > viewX - interactionRadius && blade.x < viewX + viewWidth + interactionRadius &&
                blade.y > viewY - interactionRadius && blade.y < viewY + viewHeight + interactionRadius)
            {
                const dx = blade.x - worldMouseX;
                const dy = blade.y - worldMouseY;
                const distance = Math.sqrt(dx * dx + dy * dy);
                
                let targetRotation = blade.initialRotation;
                let targetScale = 1;
                
                if (distance < interactionRadius) {
                    const influence = Math.pow(1 - (distance / interactionRadius), 1.5);
                    const rotationInfluence = (dx / interactionRadius) * maxRotation * influence;
                    targetRotation = blade.initialRotation + rotationInfluence;
                
                    if (distance < interactionRadius * 0.4) {
                        targetScale = 1 - (1 - scaleFactor) * (1 - distance / (interactionRadius * 0.4));
                    }
                }
                
                const lerpFactor = 0.15; 
                blade.currentRotation += (targetRotation - blade.currentRotation) * lerpFactor;
                blade.scale += (targetScale - blade.scale) * lerpFactor;

                // TEMPORARILY DISABLE CULLING CHECK FOR DEBUGGING:
                // Check if blade is strictly within view *before drawing*
                // if (blade.x + blade.w > viewX && blade.x < viewX + viewWidth &&
                //     blade.y > viewY && blade.y - blade.h < viewY + viewHeight) // Check top of blade
                // {
                // <<< REPLACE with corrected AABB Culling Check >>>
                const bladeLeft = blade.x - blade.w * 0.5; // Approx left edge
                const bladeRight = blade.x + blade.w * 0.5; // Approx right edge
                const bladeTop = blade.y - blade.h;      // Tip Y
                const bladeBottom = blade.y;             // Base Y

                const viewLeft = viewX;
                const viewRight = viewX + viewWidth;
                const viewTop = viewY;
                const viewBottom = viewY + viewHeight;

                // <<< RE-ENABLE Inner Culling Check >>>
                if (bladeRight > viewLeft &&    // Blade right is right of view left
                    bladeLeft < viewRight &&    // Blade left is left of view right
                    bladeBottom > viewTop &&    // Blade base is below view top
                    bladeTop < viewBottom)      // Blade tip is above view bottom
                {
                    visibleCount++;
                    drawBlade(blade);
                } // End Inner if (AABB check)
            } // <<< Explicitly close Outer if
        }); // <<< Explicitly close forEach lambda
        // console.log("Total blades:", blades.length, " Attempted to draw:", visibleCount); // Modified log - REMOVE THIS LINE
        // <<< Restore original log message >>>
        console.log("Blades Processed(near view):", blades.length, " Visible & Drawn:", visibleCount);

        // Restore canvas transform
        ctx.restore();

        requestAnimationFrame(updateAndDraw);
    }

    // --- Draw Single Blade Function ---
    function drawBlade(blade) {
        // <<< Add log to check if this function is called >>>
        console.log(`Drawing blade at world coords: (${blade.x.toFixed(1)}, ${blade.y.toFixed(1)})`);
        ctx.save();
        ctx.translate(blade.x, blade.y);
        // <<< FIX: Convert rotation degrees to radians >>>
        ctx.rotate(blade.currentRotation * Math.PI / 180); 
        ctx.scale(blade.scale, blade.scale);
        
        // Create gradient
        const gradient = ctx.createLinearGradient(0, 0, 0, -blade.h); // Gradient upwards
        gradient.addColorStop(0, blade.color1); // Base color
        gradient.addColorStop(1, blade.color2); // Tip color
        ctx.fillStyle = gradient;
        
        // Draw blade shape (using path for clip-path effect)
        // <<< Adjust path for wider base and softer tip >>>
        ctx.beginPath();
        ctx.moveTo(-blade.w * 0.4, 0);       // Wider base left
        ctx.lineTo(blade.w * 0.4, 0);        // Wider base right
        // Use quadratic curves for softer sides leading to the tip
        ctx.quadraticCurveTo(blade.w * 0.3, -blade.h * 0.8, 0, -blade.h); // Curve to tip (right side)
        ctx.quadraticCurveTo(-blade.w * 0.3, -blade.h * 0.8, -blade.w * 0.4, 0); // Curve to base (left side)
        // Old pointy path:
        // ctx.lineTo(blade.w * 0.4, -blade.h * 0.95); // Top right point (adjust polygon %)
        // ctx.lineTo(blade.w * 0.5, -blade.h);      // Top center point
        // ctx.lineTo(blade.w * 0.6, -blade.h * 0.95); // Top left point
        ctx.closePath();
        ctx.fill();

        // TODO: Add subtle shadow if needed (can impact performance)
        // ctx.shadowColor = 'rgba(0,0,0,0.3)';
        // ctx.shadowBlur = 3;
        // ctx.shadowOffsetY = 2;

        ctx.restore();
    }

    // --- Blade Count Calculation ---
    function calculateBladeCount() {
        // Keep density high for the *world*, culling handles performance
        const screenArea = width * height; 
        const density = 0.6; 
        const maxBlades = Math.min(15000, Math.max(1000, Math.floor(screenArea * density / 100)));
        // Note: We could potentially generate blades for a larger virtual area
        // if we wanted panning, but for fixed zoom, this is okay.
        return maxBlades;
    }

    // --- Event Listeners ---
    document.addEventListener('mousemove', (e) => {
        mouseX = e.clientX;
        mouseY = e.clientY;
    });

    window.addEventListener('resize', () => {
        width = canvas.width = window.innerWidth;
        height = canvas.height = window.innerHeight;
        // Regenerate blades on resize 
        generateBlades(); 
        mouseX = width / 2;
        mouseY = height / 2;
    });

    // --- Initial Setup ---
    generateBlades(); 
    requestAnimationFrame(updateAndDraw);
}); 