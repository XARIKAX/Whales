"""Body colourways as an HSV remap of the D/B/G classes.

Luminance is preserved: only hue and the saturation/value scales move, so the
sprite keeps its modelling instead of turning into a flat recolour. K (outline)
and W (specular) are never touched — the outline stays black and the highlight
stays a highlight in every colourway.
"""
import colorsys

from sprite import PAL


def _remap(rgb, hue, sat_scale, val_scale):
    r, g, b = (v / 255 for v in rgb)
    h, s, v = colorsys.rgb_to_hsv(r, g, b)
    if hue is not None:
        h = hue
    s = min(1.0, s * sat_scale)
    v = min(1.0, v * val_scale)
    return tuple(int(round(c * 255)) for c in colorsys.hsv_to_rgb(h, s, v))


def palette_for(hue, sat_scale, val_scale, gild_belly=False):
    """A full palette dict for the renderer."""
    pal = dict(PAL)
    for ch in ("D", "B"):
        pal[ch] = _remap(PAL[ch], hue, sat_scale, val_scale)

    if gild_belly:
        # Gilded forces the belly to gold rather than leaving it grey-white,
        # otherwise the colourway reads as a blue whale wearing a gold coat.
        pal["G"] = _remap(PAL["G"], 0.115, 0.55, 1.0)
        pal["W"] = _remap(PAL["W"], 0.13, 0.30, 1.0)
    else:
        # The belly follows the body's value so dark bodies do not keep a
        # bright white chest, but keeps its own low saturation.
        pal["G"] = _remap(PAL["G"], None, 1.0, min(1.0, val_scale * 1.05))
        pal["W"] = _remap(PAL["W"], None, 1.0, min(1.0, val_scale * 1.15))

    return pal
