import * as THREE from 'three';

/**
 * The picture frame: moulding, mat board, backing.
 *
 * Built in code rather than modelled in Blender, because a picture frame is one
 * of the few objects that is *entirely* describable as "rectangle with a
 * rectangular hole, bevelled" — which is precisely what THREE.Shape +
 * ExtrudeGeometry produce. A downloaded .glb would arrive with its own scale,
 * its own aperture ratio and its own materials to reconcile, for the same
 * silhouette. See docs/ASSET_TASKS.md task 6 for the drop-in seam if a real
 * model is wanted later.
 *
 * Everything here is a module-level singleton. ~18 billboards share one
 * geometry and one material set, so the frame costs a handful of draw calls
 * total rather than per billboard.
 */

/**
 * The photograph itself. Still 3:4 portrait, and still ~95% of a phone's
 * horizontal window at closest approach once the mat and moulding are added on
 * — the aperture shrank from 5.1 x 6.8 so the *outer* dimension could stay put.
 * three.js `fov` is the *vertical* angle (48 in StoryCanvas) and horizontal
 * falls out of the canvas aspect, so a phone held upright has ~23° of
 * horizontal against 48° of vertical: portrait puts the frame's long edge on
 * the axis that has room for it. See docs/ASSET_TASKS.md task 1.
 */
export const PHOTO_W = 4.5;
export const PHOTO_H = 6.0;

/** Visible card between photograph and moulding. */
const MAT_BORDER = 0.3;
/** Width of the moulding's face. */
const MOULDING_W = 0.35;
/** How far the moulding stands proud of the mat. */
const MOULDING_D = 0.2;

/**
 * Outer dimensions, deliberately equal to the old grey backing panel
 * (5.6 x 7.3): the composition, the camera framing and the lateral clearance
 * were all tuned against that footprint, so the frame gets nicer without
 * anything else needing to move.
 */
export const OUTER_W = PHOTO_W + 2 * (MAT_BORDER + MOULDING_W); // 5.8
export const OUTER_H = PHOTO_H + 2 * (MAT_BORDER + MOULDING_W); // 7.3

/**
 * Edge radius. Sharp 90° edges are the single biggest reason CG props read as
 * fake — real objects always have enough radius to catch a highlight, and the
 * key light in Scene.tsx rakes almost horizontally, which is exactly the angle
 * that finds one.
 */
const BEVEL = 0.045;

/**
 * The mat overlaps the photograph slightly, as a real mount does. Hides the
 * crop edge, and means a photo whose aspect is a little off 3:4 is cropped by
 * the frame instead of showing a sliver of backing board.
 */
const MAT_OVERLAP = 0.05;

/**
 * Z layout, front-facing +Z. Gaps between coplanar-ish surfaces are all >= 0.06
 * on purpose: mobile GPUs may hand back a 16-bit depth buffer, where the
 * resolvable step at ~30 units out is already north of 0.1, and every frame is
 * yawed to face the camera so these planes are *always* viewed obliquely where
 * depth precision is thinnest. Anything tighter shimmers on a phone.
 */
export const PHOTO_Z = -0.06;
const MAT_Z = 0;
const MOULDING_Z = 0.06;
export const BACKING_Z = -0.2;
const BACKING_D = 0.1;

/**
 * Corners of a centred rectangle.
 *
 * Points rather than a ready-made Path because the outer contour has to be a
 * Shape (only Shapes carry holes) and the holes have to be Paths, and
 * `Shape.copy()` cannot take a Path — it reads `source.holes.length` and
 * throws. Handing both constructors the same point list avoids the whole issue.
 */
function rectPoints(w: number, h: number) {
  return [
    new THREE.Vector2(-w / 2, -h / 2),
    new THREE.Vector2(w / 2, -h / 2),
    new THREE.Vector2(w / 2, h / 2),
    new THREE.Vector2(-w / 2, h / 2),
  ];
}

/** Closed rectangular outline, for use as a hole. */
function rectHole(w: number, h: number) {
  const path = new THREE.Path(rectPoints(w, h));
  path.closePath();
  return path;
}

function buildMoulding() {
  /**
   * ExtrudeGeometry's bevel grows the outer contour *outward* by bevelSize and
   * shrinks holes *inward* by the same, and adds bevelThickness to each end of
   * the extrusion. So every dimension is pre-shrunk here by exactly what the
   * bevel will add back, and the finished part measures OUTER_W x OUTER_H x
   * MOULDING_D with its inner edge on the mat border. Skipping this is how you
   * get a frame that is mysteriously 0.09 too wide.
   */
  const outer = new THREE.Shape(rectPoints(OUTER_W - 2 * BEVEL, OUTER_H - 2 * BEVEL));
  outer.closePath();

  const holeW = OUTER_W - 2 * MOULDING_W + 2 * BEVEL;
  const holeH = OUTER_H - 2 * MOULDING_W + 2 * BEVEL;
  outer.holes.push(rectHole(holeW, holeH));

  const geo = new THREE.ExtrudeGeometry(outer, {
    depth: MOULDING_D - 2 * BEVEL,
    bevelEnabled: true,
    bevelThickness: BEVEL,
    bevelSize: BEVEL,
    bevelSegments: 2,
    curveSegments: 1,
    steps: 1,
  });

  // Extrusion runs 0..depth in local space; put the back face on the origin so
  // the mesh can be placed by the surface that touches the mat.
  geo.translate(0, 0, BEVEL);
  geo.computeVertexNormals();
  return geo;
}

/** Flat mount board: a plane with the aperture cut out of it. */
function buildMat() {
  const shape = new THREE.Shape(rectPoints(OUTER_W, OUTER_H));
  shape.closePath();
  shape.holes.push(rectHole(PHOTO_W - 2 * MAT_OVERLAP, PHOTO_H - 2 * MAT_OVERLAP));
  return new THREE.ShapeGeometry(shape);
}

export const mouldingGeometry = buildMoulding();
export const matGeometry = buildMat();

/**
 * Slightly smaller than the moulding so their side faces are not coplanar —
 * two coplanar faces at the silhouette is the one place z-fighting is visible
 * against the fog.
 */
export const backingGeometry = new THREE.BoxGeometry(OUTER_W - 0.1, OUTER_H - 0.1, BACKING_D);

/**
 * Dark walnut and cream card: a gallery frame, which is what "nicer than a grey
 * border" means here. A light mat also does real work in a dark foggy scene —
 * it separates the photograph from the void instead of letting it bleed out.
 *
 * For a gilt frame instead, this is a one-liner: color '#b08d57',
 * metalness 0.8, roughness 0.32.
 */
export const mouldingMaterial = new THREE.MeshStandardMaterial({
  color: '#4a3a2c',
  roughness: 0.55,
  metalness: 0.05,
});

export const matMaterial = new THREE.MeshStandardMaterial({
  color: '#e8e0d1',
  roughness: 0.9,
});

export const backingMaterial = new THREE.MeshStandardMaterial({
  color: '#1c1a17',
  roughness: 0.85,
});

/** Local Z for each part, so Billboard.tsx doesn't restate the layout. */
export const LAYOUT = { photo: PHOTO_Z, mat: MAT_Z, moulding: MOULDING_Z, backing: BACKING_Z };
