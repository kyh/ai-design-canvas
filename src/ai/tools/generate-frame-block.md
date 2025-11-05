Use this tool to generate a frame block on the canvas. Frame blocks are your primary drawing tool! They can be used creatively to draw shapes, objects, and decorative elements by leveraging their styling properties.

## When to Use This Tool

Use Generate Frame Block when:

1. You need to draw geometric shapes (circles, squares, rectangles)
2. You want to create decorative elements (rounded cards, badges, buttons)
3. You need background elements (colored areas, patterns)
4. You want to create complex objects by combining multiple frames (e.g., faces, animals, objects)

## Creative Drawing Techniques

### Circles
- Set width and height equal
- Use radius of 50% (set all corners to width/2 or height/2)
- Example: width: 100, height: 100, radius: { tl: 50, tr: 50, br: 50, bl: 50 }

### Squares/Rectangles
- Use width and height as needed for the desired shape
- Use radius property for rounded corners (0-50% of the smallest dimension)

### Rounded Shapes
- Use the radius property to round corners
- Set individual corner values (tl, tr, br, bl) for asymmetric rounding

### Complex Objects
- Break complex objects into simple shapes
- Combine multiple frame blocks with different sizes, positions, and colors
- Use rotation for angled elements
- Use opacity for layering effects

## Frame Block Properties

- **label**: Descriptive name (e.g., "Sun", "Background Card", "Button")
- **x, y**: Position on 1280x720 canvas (center is ~640, 360)
- **width, height**: Dimensions (use equal width/height for circles)
- **visible**: true (default)
- **opacity**: 0-100 (100 = fully opaque, lower for transparency effects)
- **background**: Hex color (e.g., "#FFD700" for yellow, "#FF0000" for red)
- **radius**: Object with tl/tr/br/bl values in pixels. For circles, set all corners to width/2
- **border**: Optional border with width, color, and dash array
- **shadow**: Optional shadow for depth (color, offsetX, offsetY, blur, enabled)
- **rotation**: Optional rotation in degrees
- **scaleX, scaleY**: Optional scaling factors (default 1)

## Examples

<example>
User: Draw a sun
Assistant: I'll create a circular frame block with a yellow background to represent the sun.
*Uses Generate Frame Block with:*
- width: 100, height: 100 (circle)
- background: "#FFD700" (yellow/gold)
- radius: { tl: 50, tr: 50, br: 50, bl: 50 } (50% for perfect circle)
- x: 640, y: 360 (center)
</example>

<example>
User: Create a rounded button
Assistant: I'll create a frame block with rounded corners and a colored background.
*Uses Generate Frame Block with:*
- width: 200, height: 50
- background: "#007AFF" (blue)
- radius: { tl: 25, tr: 25, br: 25, bl: 25 } (rounded corners)
- shadow: { enabled: true, offsetY: 2, blur: 4 }
</example>

<example>
User: Draw a house
Assistant: I'll create a house by combining multiple frame blocks - a rectangle for the body and a rotated frame for the roof.
*Uses Generate Frame Block multiple times:*
1. Body: rectangle with appropriate dimensions
2. Roof: frame rotated 45 degrees or positioned to create triangle effect
</example>

## Important Notes

- For circles: width === height, and radius should be 50% (set all corners to width/2)
- Position blocks thoughtfully, leaving space for other elements
- Use vibrant, appropriate colors for the objects you're drawing
- Do not include "id" field - it's auto-generated
- Think creatively - break complex objects into simple shapes

## Summary

Generate Frame Block is your primary drawing tool. Use it creatively to draw any shape, object, or decorative element on the canvas by combining multiple frames with different properties.
