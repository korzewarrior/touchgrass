document.addEventListener('DOMContentLoaded', () => {
    const grassField = document.getElementById('grass-field');

    if (!grassField) {
        console.error("Error: #grass-field element not found!");
        return;
    }

    const fieldRect = grassField.getBoundingClientRect(); // Get field dimensions once

    // --- Blade Generation --- (Higher Density, Pre-calculated Positions)
    const { numBlades, blades } = generateBlades(fieldRect);
    console.log(`Generated ${blades.length} grass blades.`);

    // --- Interaction Logic --- (Optimized, Smaller Radius)
    const interactionRadius = 50; // <<< REDUCED radius
    const maxRotation = 70;       // Slightly more rotation
    const scaleFactor = 0.9;      // Restore scaling

    let mouseX = -interactionRadius * 2; // Initialize far off-screen
    let mouseY = -interactionRadius * 2;

    // Use a throttled mouse move listener for potentially less frequent updates if needed
    // Though requestAnimationFrame handles the rendering smoothness
    document.addEventListener('mousemove', (e) => {
        mouseX = e.clientX;
        mouseY = e.clientY;
    });

    // --- Blade Generation Function ---
    function generateBlades(containerRect) {
        const bladeCount = calculateBladeCount();
        const bladeDataArray = [];
        const fragment = document.createDocumentFragment(); // Use fragment for performance

        for (let i = 0; i < bladeCount; i++) {
            const blade = document.createElement('div');
            blade.classList.add('grass-blade');

            // Random % position
            const xPercent = Math.random() * 100;
            const yPercent = Math.random() * 100;
            blade.style.left = `${xPercent}%`;
            blade.style.top = `${yPercent}%`;

            // Randomize appearance
            const height = 30 + Math.random() * 20; // 30px to 50px
            const width = 2 + Math.random() * 2.5; // 2px to 4.5px
            blade.style.height = `${height}px`;
            blade.style.width = `${width}px`;
            blade.style.zIndex = Math.floor(yPercent * 10); // z-index based on y (0-999)

            // Randomize color variations
            blade.style.setProperty('--lightness-variation', `${Math.random() * 20}%`);
            blade.style.setProperty('--hue-variation', `${(Math.random() - 0.5) * 15}`); // -7.5 to +7.5 hue shift

            // Random initial slight rotation/bend
            const initialRotation = (Math.random() - 0.5) * 20; // -10 to +10 deg
            blade.style.transform = `rotate(${initialRotation}deg)`;

            fragment.appendChild(blade);

            // *** Pre-calculate base pixel coordinates ***
            const initialBaseXPx = (xPercent / 100) * containerRect.width + (width / 2);
            const initialBaseYPx = (yPercent / 100) * containerRect.height + height;

            bladeDataArray.push({ 
                element: blade, 
                initialRotation: initialRotation,
                baseXPx: initialBaseXPx,
                baseYPx: initialBaseYPx
            });
        }
        grassField.appendChild(fragment); // Append all at once
        return { numBlades: bladeCount, blades: bladeDataArray };
    }

    // --- Update Loop Function ---
    function updateGrass() {
        blades.forEach(bladeData => {
            const bladeEl = bladeData.element;
            
            // *** Use pre-calculated base positions ***
            const bladeBaseX = bladeData.baseXPx;
            const bladeBaseY = bladeData.baseYPx;

            const dx = bladeBaseX - mouseX;
            const dy = bladeBaseY - mouseY;
            const distance = Math.sqrt(dx * dx + dy * dy);

            let scale = 1;
            let currentRotation = bladeData.initialRotation;

            if (distance < interactionRadius) {
                const influence = Math.pow(1 - (distance / interactionRadius), 1.5);

                // Calculate rotation (based on horizontal distance)
                const rotationInfluence = (dx / interactionRadius) * maxRotation * influence;
                currentRotation = bladeData.initialRotation + rotationInfluence;

                // Add scaling if very close
                if (distance < interactionRadius * 0.4) { // Adjust scaling threshold
                    scale = 1 - (1 - scaleFactor) * (1 - distance / (interactionRadius * 0.4));
                }
            }

            // Construct the transform string
            const targetTransform = `rotate(${currentRotation}deg) scale(${scale})`;
            bladeEl.style.transform = targetTransform;
        });

        requestAnimationFrame(updateGrass);
    }

    // --- Blade Count Calculation ---
    function calculateBladeCount() {
        const screenArea = window.innerWidth * window.innerHeight;
        const density = 0.6; // <<< MUCH MUCH higher density
        // Adjust max based on typical screen sizes to prevent crashing
        const maxBlades = Math.min(15000, Math.max(1000, Math.floor(screenArea * density / 100)));
        console.log("Target blades:", maxBlades);
        return maxBlades;
    }

    // --- Start the process ---
    requestAnimationFrame(updateGrass);
}); 