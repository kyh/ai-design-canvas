Use this tool to generate a text block on the canvas. Text blocks are versatile elements that can be used for headings, paragraphs, labels, captions, body text, and even decorative text elements.

## When to Use This Tool

Use Generate Text Block when:

1. The user requests text content on the canvas (headings, paragraphs, labels, etc.)
2. You need to add typography or text-based design elements
3. You want to create decorative text elements or text-based graphics
4. The user asks for labels, captions, or annotations to accompany other elements

## Text Block Properties

- **label**: Descriptive name for the block (e.g., "Heading", "Body Text", "Label")
- **text**: The actual text content to display
- **x, y**: Position on the canvas (default canvas is 1280x720, center is ~640, 360)
- **width, height**: Dimensions of the text block
- **color**: Text color as hex (e.g., "#000000" for black, "#FFFFFF" for white)
- **fontSize**: Font size in pixels
- **lineHeight**: Line height multiplier or pixels
- **letterSpacing**: Letter spacing in pixels
- **textAlign**: Alignment ("center", "left", "right", "justify")
- **font**: Font family and weight
- **textTransform**: Optional text transformation ("inherit", "capitalize", "uppercase", "lowercase")
- **textDecoration**: Optional decoration ("inherit", "overline", "line-through", "underline")
- **opacity**: 0-100 (100 = fully opaque)
- **visible**: true (default)
- **rotation**: Optional rotation in degrees
- **background**: Optional background color for the text block
- **shadow**: Optional shadow for depth
- **border**: Optional border around the text block

## Best Practices

- Use appropriate font sizes for readability (typically 12-72px for most use cases)
- Set appropriate line height for readability (1.2-1.6x font size is common)
- Choose high contrast colors for text readability
- Position text blocks thoughtfully relative to other canvas elements
- Use textAlign to control text positioning within the block
- Consider using background colors or borders to make text stand out

## Examples

<example>
User: Add a heading "Welcome" at the top center
Assistant: I'll create a text block with the heading "Welcome" positioned at the top center of the canvas.
*Uses Generate Text Block with:*
- text: "Welcome"
- x: 640, y: 100 (top center)
- fontSize: 48
- textAlign: "center"
- font: { family: "Inter", weight: "700" }
</example>

<example>
User: Add a label "Click me" next to the button
Assistant: I'll create a text label positioned next to the button.
*Uses Generate Text Block with:*
- text: "Click me"
- Appropriate positioning relative to button
- fontSize: 14
- color: "#333333"
</example>

## Summary

Use Generate Text Block to add any text content to the canvas. It's essential for creating typography, labels, headings, and text-based design elements.
