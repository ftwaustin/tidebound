// Movement and aiming are independent. Arrow keys take priority while held;
// mouse movement takes aiming back after the arrows are released.
export function readControls(keys,touch,mouseAngle,facing){
  const x=Number(keys.has('d'))-Number(keys.has('a'))+touch.x;
  const y=Number(keys.has('s'))-Number(keys.has('w'))+touch.y;
  const aimX=Number(keys.has('arrowright'))-Number(keys.has('arrowleft'));
  const aimY=Number(keys.has('arrowdown'))-Number(keys.has('arrowup'));
  const arrows=Boolean(aimX||aimY);
  const angle=arrows?Math.atan2(aimY,aimX):mouseAngle??(Math.hypot(touch.x,touch.y)>.15?Math.atan2(touch.y,touch.x):facing);
  return {x:Math.max(-1,Math.min(1,x)),y:Math.max(-1,Math.min(1,y)),angle:Math.round(angle/(Math.PI/4))*Math.PI/4,fire:arrows||keys.has(' ')||touch.fire};
}
