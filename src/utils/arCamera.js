/**
 * The camera an immersive session is given.
 *
 * Three's WebXR manager takes the session's depth range straight off this:
 * `updateCamera` reads `camera.near` into the render state it hands the
 * device. So these two numbers are what the headset actually clips against,
 * which makes them worth stating in one place with the reason attached.
 *
 * The near plane is a centimetre rather than the default ten. Nothing in the
 * globe is solid and there is nothing to collide with, but at 0.1m the viewer
 * could not lean into it: the front of the city was sliced open at arm's
 * length, which is exactly the distance someone holds a snow globe at to look
 * inside it. A centimetre is closer than an eye can focus, so leaning in now
 * passes through the glass instead of cutting it.
 *
 * The far plane is pulled in to match. Depth precision is spent on the ratio
 * between the two, so a hundredfold closer near plane against an unbounded
 * far one would trade clipping for z-fighting across the whole park.
 */
export const AR_CAMERA = { position: [0, 1.6, 0], fov: 50, near: 0.01, far: 200 }
