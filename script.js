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

    // --- Blade Generation Function ---
    function generateBlades() {
        blades = []; 
        const bladeCount = calculateBladeCount(); 
        console.log(`Generating ${bladeCount} blades`);
        
        for (let i = 0; i < bladeCount; i++) {
            // Appearance (Larger Blades, Adjusted Colors)
            const bladeHeight = 50 + Math.random() * 30; 
            const bladeWidth = 3 + Math.random() * 3;   
            const hueVariation = (Math.random() - 0.5) * 20; // Increased hue range (-10 to +10)
            const lightnessVariation = 10 + Math.random() * 20; // Shift base lightness slightly higher (35%-55% range)
            // Base HSL: Slightly brighter/more saturated base
            const color1 = `hsl(${115 + hueVariation}, 70%, ${35 + lightnessVariation}%)`; 
            const color2 = `hsl(${120 + hueVariation}, 60%, ${45 + lightnessVariation}%)`;
            
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
            // Check if blade *base* is roughly within the extended view for interaction
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

                // Check if blade is strictly within view *before drawing*
                if (blade.x + blade.w > viewX && blade.x < viewX + viewWidth &&
                    blade.y > viewY && blade.y - blade.h < viewY + viewHeight) // Check top of blade
                {
                    visibleCount++;
                    drawBlade(blade);
                }
            }
        });
        console.log("Blades Processed(near view):", blades.length, " Visible & Drawn:", visibleCount);

        // Restore canvas transform
        ctx.restore();

        requestAnimationFrame(updateAndDraw);
    }

    // --- Draw Single Blade Function ---
    function drawBlade(blade) {
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
        ctx.beginPath();
        ctx.moveTo(-blade.w * 0.2, 0);       // Bottom left point (adjust polygon %)
        ctx.lineTo(blade.w * 0.2, 0);        // Bottom right
        ctx.lineTo(blade.w * 0.4, -blade.h * 0.95); // Top right point (adjust polygon %)
        ctx.lineTo(blade.w * 0.5, -blade.h);      // Top center point
        ctx.lineTo(blade.w * 0.6, -blade.h * 0.95); // Top left point
        ctx.closePath();
        ctx.fill();

        // <<< REVERT: Remove shadow logic for now >>>
        /*
        ctx.shadowColor = 'rgba(0,0,0,0.5)'; 
        ctx.shadowBlur = 5;             
        ctx.shadowOffsetY = 2;             
        ctx.shadowOffsetX = 1;             
        ctx.fill(); 
        */

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
    });

    // --- Initial Setup ---
    generateBlades(); 
    requestAnimationFrame(updateAndDraw);
}); 