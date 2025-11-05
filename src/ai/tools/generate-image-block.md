Use this tool to generate an image block on the canvas. Image blocks display images from URLs and can be styled with various properties for positioning and sizing.

## When to Use This Tool

Use Generate Image Block when:

1. The user requests an image to be displayed on the canvas
2. You need to add visual elements like photos, illustrations, or graphics
3. The user asks for image placeholders or image content
4. You want to incorporate external image resources

## Image Block Properties

- **label**: Descriptive name for the block (e.g., "Logo", "Photo", "Illustration")
- **url**: Image URL (can use placeholder URLs like 'https://via.placeholder.com/400' for now)
- **x, y**: Position on the canvas
- **width, height**: Dimensions of the image block
- **fit**: How the image fits within the block ("contain", "cover", "fill", "fitWidth", "fitHeight")
- **position**: Image position within the block ("center", "top", "bottom", "left", "right")
- **opacity**: 0-100 (100 = fully opaque)
- **visible**: true (default)
- **rotation**: Optional rotation in degrees
- **shadow**: Optional shadow for depth
- **border**: Optional border around the image
- **radius**: Optional rounded corners

## Best Practices

- Use appropriate image dimensions for the canvas size (1280x720 default)
- Choose appropriate fit mode based on desired effect:
  - "contain": Image fits within block, maintains aspect ratio
  - "cover": Image fills block, may be cropped, maintains aspect ratio
  - "fill": Image stretches to fill block, may distort
- Use placeholder URLs if no specific image is provided
- Consider using shadows or borders to make images stand out
- Position images thoughtfully relative to other canvas elements

## Examples

<example>
User: Add a logo image at the top left
Assistant: I'll create an image block with a logo positioned at the top left of the canvas.
*Uses Generate Image Block with:*
- url: "https://via.placeholder.com/200"
- x: 50, y: 50 (top left)
- width: 200, height: 200
- fit: "contain"
</example>

<example>
User: Add a background image that covers the whole canvas
Assistant: I'll create a full-canvas image block as a background.
*Uses Generate Image Block with:*
- url: "https://via.placeholder.com/1280x720"
- x: 0, y: 0
- width: 1280, height: 720
- fit: "cover"
</example>

## Summary

Use Generate Image Block to add images to the canvas. You can use placeholder URLs for now, and the system may support image generation in the future.
