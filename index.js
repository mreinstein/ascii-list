import { Display } from 'rot-js'
import clamp       from 'clamp'
import colors      from './colors.js'
import sinMinus    from './sin-minus.js'
import tileMap     from './tile-map.js'


const model = {
    columns: 0,
    rows: 0,
    font: {
        width: 0,
        height: 0
    },

    listItems: [ ],

    animations: [ ],
    movePaths: [ ],

    consoles: [
        {
            parentConsole: -1,
            layout: {
                width: 40,
                height: 1,
                left: 4,
                top: 4
            }
        }
    ],
    texts: [ ]
}

const animationTypes = [
    {
        life: {
            type: 'CONST',
            factor: 400
        },
        colorMOD: {
            effect: 'ALPHA+',
            color: hexToRgb(colors.sepia_9),
            efactor: 1.0,
            rate: 'SIN-'
        }
    }
]


function generateRandomList (length) {
    for (let i=0; i < length; i++) {

        const c = {
            parentConsole: 0,
            layout: {
                width: 45,
                height: 1,
                left: 0,
                top: i
            }
        }
        model.consoles.push(c)

        const consoleId = model.consoles.length-1

        model.listItems.push({
            console: consoleId,
            sortValue: 1
        })

        model.texts.push({
           console: consoleId, // id of the console this text is rendering in
            text: '█ HERE IS SOME TEXT!' + Math.round(Math.random() * 1000),
            bkgColor: 'black',
            color: hexToRgb(colors.green_3),
            layout: {
                left: 0,
                top: 0
            }
        })

        const ac = [ colors.yellow_2, colors.green_2, colors.orange_2 ]

        model.texts.push({
           console: consoleId, // id of the console this text is rendering in
            text: '|||||||',
            bkgColor: 'black',
            color: hexToRgb(ac[Math.floor(Math.random() * ac.length)]),
            layout: {
                right: 10,
                top: 0
            }
        })
    }
}


/*
 Blends two colours together

 @param Array src  rgb tuplet
 @param Array dst  rgb tuplet
 @param Number amt how much to blend from src to dst [0..1]
 @return Array resulting blended color in rgb tuplet
*/
function blend (src, dst, amt) {
    return dst.map((c, i) => Math.round(amt * c + (1 - amt) * src[i]))
}


function hexToRgb (hex) {
    //const num = parseInt(hex, 16)
    const num = hex

    const red = num >> 16
    const green = (num >> 8) & 255
    const blue = num & 255
    return [ red, green, blue ]
}


/*
 animate movement of text console from position A -> B along a rectangular path

 ▒▒▒ here is text item in position A
 ▒
 ▒
 ▒▒▒ (this is position B)
 */
function generateRectangularPath (startRow, endRow) {
    const direction = endRow > startRow ? 1 : -1
    const rowCount = Math.abs(endRow - startRow)
    const rectWidth = Math.floor(rowCount / 2) + 1

    const path = [ ]

    for (let i=1; i <= rectWidth; i++)
        path.push([ -1, 0 ]) // col, row
        //path.push([ -i, 0 ])

    for (let i=1; i <= rowCount; i++)
        path.push([ 0, direction ])
        //path.push([ -rectWidth, i ])

    for (let i=rectWidth; i > 0; i--)
        path.push([ 1, 0 ]) // col, row
        //path.push([ -i, endRow ])

    return path
}


function loadFont ({ width, height }) {
    model.font.width = width
    model.font.height = height
    model.columns = Math.ceil(window.outerWidth / width)
    model.rows = Math.ceil(window.outerHeight / height)

    const img = new Image();

    img.src = `/font/font_${model.font.width}_${model.font.height}.png`;
    img.onload = _ => {
        for (const glyph in tileMap) {
            const idx = tileMap[glyph];

            // the font files always have 32 columns
            const sx = (idx % 32) * model.font.width;
            const sy = (idx / 32 | 0) * model.font.height;

            tileMap[glyph] = [ sx, sy ];
        }

        display = new Display({
            bg: 'black',
            layout: 'tile-gl',
            tileColorize: true,
            tileWidth: model.font.width,
            tileHeight: model.font.height,
            tileSet: img,
            tileMap,

            // defaults to 80x25
            width: model.columns,
            height: model.rows
        })

        container = display.getContainer()
        container.style.imageRendering = 'pixelated'
        document.body.appendChild(container)
        last = performance.now()
        animate();
    }
}


let last, display, container


function drawLabel (label) {
    let startCol, startRow
    if (label.box) {
        startCol = label.box.minCol + label.point[0]
        startRow = label.box.minRow + label.point[1]
    } else {
        const { line } = label
        startCol = line.start.box.minCol + line.start.point.col + label.point[0]
        startRow = line.start.box.minRow + line.start.point.row + label.point[1]
    }

    drawText(startCol, startRow, label.text, '#333')
}


function drawText (startCol, startRow, str, fg, bg) {
    const rows = str.split('\n')
    let currentRow = startRow

    for (const row of rows) {
        for (let i=0; i < row.length; i++)
            display.draw(startCol + i, currentRow, row[i], fg, bg)

        currentRow++
    }
}


function draw () {
    display.clear();

    for (const text of model.texts) {
        let left = 0, top = 0

        // traverse up through consoles to determine the position
        let c = model.consoles[text.console]
        while (c) {
            left += c.layout.left
            top += c.layout.top
            c = (c.parentConsole >= 0) ? model.consoles[c.parentConsole] : undefined
        }

        if (text.layout.left !== undefined) {
            left += text.layout.left
        } else if (text.layout.right !== undefined) {
            const directParent = model.consoles[text.console]
            left += (directParent.layout.width - text.text.length - text.layout.right)
        }
        
        top += text.layout.top

        const color = `rgb(${text.color[0]}, ${text.color[1]}, ${text.color[2]})`
        drawText(left, top, text.text, color, text.bkgColor)
    }
}


function animate () {
    const now = performance.now()
    
    // update the movement path animations
    for (let i=model.movePaths.length-1; i >= 0; i--) {
        const movePath = model.movePaths[i]
        let dt = now - last

        if (movePath.delayStart > 0) {
            movePath.delayStart -= dt
            if (movePath.delayStart < 0)
                dt = -movePath.delayStart
            else
                dt = 0
        }

        if (dt > 0) {
            movePath.accum += dt
            movePath.ttl -= dt

            const c = model.consoles[movePath.console]
            while (movePath.accum >= movePath.msPerPathSegment) {
                movePath.accum -= movePath.msPerPathSegment
                const next = movePath.path.shift()
                if (!next)
                    break

                c.layout.left += next[0]
                c.layout.top += next[1]
            }
        }

        if (movePath.ttl <= 0) {
            const texts = [ ]

            model.texts.forEach(function (text, idx) {
                if (text.console === movePath.console)
                    texts.push(idx)
            })

            for (const idx of texts) {
                // apply an animation to set white and fade after placement
                model.animations.push(
                {
                    type: 0,  // id of the animation type
                    text: idx,  // id of the text this animation is applied to
                    accum: 0 // milliseconds since animation was added to text
                })
            }

            model.movePaths.splice(i, 1)
        }
    }

    for (let i=model.animations.length-1; i >= 0; i--) {
        const a = model.animations[i]
        let dt = now - last

        a.accum += dt

        const t = animationTypes[a.type]

        if (t.colorMOD.effect === 'ALPHA+') {
            let amt
            if (t.colorMOD.rate === 'SIN-')
                amt = sinMinus(clamp(a.accum / t.life.factor, 0, 1))
            else if (t.colorMOD.rate === 'LINEAR')
                amt = 1 - clamp(a.accum / t.life.factor, 0, 1)
            
            const text = model.texts[a.text]

            if (!text.originalColor)
                text.originalColor = text.color

            const src = t.colorMOD.color
            const dst = text.originalColor

            text.color = blend(dst, src, amt)
        }
        
        if (t.life.type === 'CONST' && a.accum >= t.life.factor)
            model.animations.splice(i, 1)
    }
    
	draw()

    last = now

	requestAnimationFrame(animate)
}


generateRandomList(60)

loadFont({ width: 8, height: 10 })


window.shuffle = function () {
    for (const i of model.listItems) {
        // ~80% of the items shouldn't move each shuffle
        if (Math.random() < 0.2)
            i.weight = Math.round(Math.random() * 200)
    }
    
    model.listItems.sort((a, b) => {
        if (a.weight > b.weight)
            return 1

        if (a.weight < b.weight)
            return -1

        return 0
    })

    model.listItems.forEach((listItem, i) => {
        const c = model.consoles[listItem.console]
        const startRow = c.layout.top
        const endRow = i

        if (startRow === endRow)
            return
        const path = generateRectangularPath(startRow, endRow)
        const msPerPathSegment = Math.floor(300 / path.length)

        model.movePaths.push({
            console: listItem.console,
            path,
            msPerPathSegment,
            delayStart: Math.round(Math.random() * 700),
            accum: 0,
            ttl: 300 // milliseconds remaining
        })
    })
}
