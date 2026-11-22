// Artwork is local so the game can also be opened directly from disk.
function loadArtwork(name) {
  const image = new Image();
  image.src = 'assets/' + name + '.webp';
  return image;
}
const routePictures = {};
let cockpitPicture, miniature;
const routeNames = ['紐約','大峽谷','黃石公園','優勝美地','邁阿密'];

function updateRouteLabel() {
  const stop = sceneIdx % SCENES.length;
  document.getElementById('scene-el').textContent = '第 ' + (stop + 1) + ' 站 · ' + routeNames[stop];
}

// Vanishing points measured on the five paintings, in normalized image coordinates.
const roadView = {
  nyc:[.505,.52], canyon:[.495,.488], yellowstone:[.5,.50],
  yosemite:[.495,.535], miami:[.49,.55]
};

const roadsideArt = {};

function loadRoute(index) {
  const id = SCENES[index % SCENES.length].id;
  if (routePictures[id]) return;
  routePictures[id] = loadArtwork('drive-'+id);
  scrollViews[id].images = ['left','right'].map(side => loadArtwork('scroll-'+id+'-'+side));
  const sprite = roadside[id].sprite;
  roadsideArt[sprite] = loadArtwork('roadside-'+sprite);
}

function prepareTour() {
  loadRoute(0);
  cockpitPicture ??= loadArtwork('cockpit');
  miniature ??= loadArtwork('coupe');
  roadsideArt.bend ??= loadArtwork('roadside-bend');
}

// Width is the projected half-width of the pavement at the dashboard, relative
// to the panorama width.
const roadside = {
  nyc:         {width:1.07, sprite:'lamp',      height:4.8, spacing:64},
  canyon:      {width:.89,  sprite:'sandstone', height:1.7, spacing:47},
  yellowstone: {width:.82,  sprite:'pine',      height:5.3, spacing:58},
  yosemite:    {width:.83,  sprite:'granite',   height:2.1, spacing:52},
  miami:       {width:.99,  sprite:'palm',     height:5.6, spacing:64}
};
let travelMeters=0, previousRoadTime=0, activeRoad='';
const roadTiles=new Map();

function resetTourMotion(){
  activeRoad='';
  previousRoadTime=0;
  travelMeters=0;
}

// Sample each painting's own asphalt. A mirrored repeat joins continuously
// in world space, so the surface travels past the camera without a loop cut.
function getRoadTile(scene,art){
  if(roadTiles.has(scene.id))return roadTiles.get(scene.id);
  const tile=document.createElement('canvas');
  tile.width=896; tile.height=384;
  const brush=tile.getContext('2d');
  const sw=art.naturalWidth, sh=art.naturalHeight;
  brush.drawImage(art,sw*.18,sh*.82,sw*.64,sh*.17,0,0,896,96);
  brush.save(); brush.translate(0,192); brush.scale(1,-1);
  brush.drawImage(tile,0,0,896,96,0,0,896,96); brush.restore();
  brush.drawImage(tile,0,0,896,192,0,192,896,192);
  roadTiles.set(scene.id,tile);
  return tile;
}

function drawPassingPavement(scene,art,center,artWidth,depth,nearZ){
  const tile=getRoadTile(scene,art);
  const halfWidth=artWidth*roadside[scene.id].width;
  const rowHeight=Math.max(2,Math.ceil(depth/(compactControls.matches ? 22 : 72)));
  // z is distance from the driver. Inverse projection produces slower flow
  // near the horizon and progressively faster flow close to the dashboard.
  ctx.save();
  for(let dy=Math.max(1,Math.ceil(depth*.055));dy<depth;dy+=rowHeight){
    const next=Math.min(depth,dy+rowHeight);
    const t=dy/depth, z=nearZ/t, nextZ=nearZ*depth/next;
    const v=((-(travelMeters+z)*16)%192+192)%192;
    const span=Math.max(.5,Math.min(191,(z-nextZ)*16));
    const w=halfWidth*(dy+next)/(2*depth);
    ctx.globalAlpha=Math.min(.88,(t-.05)*3);
    ctx.drawImage(tile,0,v,tile.width,span,center-w,VPY+dy,2*w,next-dy+.5);
  }
  ctx.restore();
}

function roadEdgeY(screenOffset,artWidth,depth,roadWidth){
  return VPY+depth*Math.abs(screenOffset)/(artWidth*roadWidth);
}

function drawPassingScenery(scene,center,artWidth,depth,nearZ){
  const layout=roadside[scene.id];
  const followsRoadEdge=scene.id!=='miami';
  const cameraHeight=1.55;
  const pair=Math.floor(travelMeters/layout.spacing);
  // Both shoulders use persistent world-space positions; new objects enter
  // only at the far plane, while passed objects leave outside the viewport.
  ctx.save();
  for(let n=pair+12;n>=pair-1;n--){
    for(const side of [-1,1]){
      const stagger=scene.id==='nyc' ? 0 : side===1 ? .46 : .07;
      const z=(n+stagger)*layout.spacing+8-travelMeters;
      if(z<1.2 || z>285)continue;
      const t=nearZ/z;
      const variation=(Math.sin(n*74.3+side)*.5+.5);
      const isSign=scene.id!=='nyc' && side===1 && n%7===4;
      const sprite=roadsideArt[isSign?'bend':layout.sprite];
      if(!sprite.naturalWidth)continue;
      const ordered=scene.id==='nyc'||scene.id==='miami';
      const scale=ordered||isSign?1:.78+.46*variation;
      const h=depth*t*(isSign?2.2:layout.height)*scale/cameraHeight;
      const w=h*sprite.naturalWidth/sprite.naturalHeight;
      const x=center+side*artWidth*t*(layout.width+(ordered?.04:.10+.22*variation));
      // Use the same projected ground line as the panorama at the sprite's foot.
      const y=followsRoadEdge ? roadEdgeY(x-center,artWidth,depth,layout.width)+1 : VPY+depth*t;
      if(x+w<0 || x-w>W || y-h>ROAD_H)continue;
      ctx.globalAlpha=Math.min(1,(285-z)/65);
      ctx.save();
      ctx.translate(x,y);
      // Keep bridge lanterns facing inward, and vary natural silhouettes.
      if(scene.id==='nyc'?side===1:!isSign && n%2===0)ctx.scale(-1,1);
      if(followsRoadEdge){
        const isRock=!isSign && (layout.sprite==='sandstone' || layout.sprite==='granite');
        const shadowWidth=w*(isRock?.38:.25);
        ctx.fillStyle='rgba(40,35,25,.32)';
        ctx.beginPath();ctx.ellipse(0,-1,shadowWidth,Math.max(.65,w*.043),0,0,2*Math.PI);ctx.fill();
      }
      const anchor=scene.id==='nyc'?.27:.5;
      ctx.drawImage(sprite,-w*anchor,-h,w,h);
      ctx.restore();
    }
  }
  ctx.restore();
}

// The two panoramas describe the actual scenery along each shoulder. Each
// texture coordinate is a position along the route, shared with the pavement.
const scrollViews = Object.fromEntries(SCENES.map(({id}) => [id, {
  images: [],
  ribbons: [], sky: null
}]));
const scrollLayout = {
  nyc:         {length:120, heights:[.60,.53], distance:11},
  canyon:      {length:200, heights:[.78,.65], distance:25},
  yellowstone: {length:160, heights:[.68,.58], distance:17},
  yosemite:    {length:185, heights:[.82,.72], distance:20},
  miami:       {length:125, heights:[.77,.57], distance:11}
};

function prepareScrollView(scene, art){
  const view=scrollViews[scene.id];
  if(view.sky || !view.images.length || !view.images.every(img=>img.naturalWidth)) return view;
  for(const img of view.images){
    const ribbon=document.createElement('canvas');
    const width=compactControls.matches ? Math.min(720,img.width) : img.width;
    const height=Math.round(img.height*width/img.width);
    ribbon.width=width*2; ribbon.height=height;
    const brush=ribbon.getContext('2d');
    brush.drawImage(img,0,0,width,height);
    brush.drawImage(img,width,0,width,height);
    view.ribbons.push(ribbon);
  }
  // Remove the painted near shops/trees behind their moving counterparts.
  // Preserve the original vanishing point and pavement, and blend the distant
  // landmark into an unobstructed sky taken from the same illustration.
  const plate=document.createElement('canvas');
  const w=plate.width=art.width, h=plate.height=art.height;
  const brush=plate.getContext('2d'), [vx,vy]=roadView[scene.id];
  brush.drawImage(art,0,0);
  brush.save();
  const edgeY=vy+(1-vy)*.5/roadside[scene.id].width;
  brush.beginPath();brush.moveTo(0,0);brush.lineTo(w,0);
  brush.lineTo(w,h*edgeY);brush.lineTo(w*vx,h*vy);brush.lineTo(0,h*edgeY);
  brush.closePath();brush.clip();
  brush.drawImage(art,w*.38,h*.015,w*.24,h*.22,0,0,w,h*edgeY+1);
  brush.restore();
  const middle=document.createElement('canvas');
  middle.width=w;middle.height=h;
  const m=middle.getContext('2d');
  m.drawImage(art,w*vx*.52,h*vy*.52,w*.48,h*.48);
  m.globalCompositeOperation='destination-in';
  const fade=m.createLinearGradient(0,0,w,0);
  for(const [at,opacity] of [[0,0],[.27,0],[.38,1],[.62,1],[.73,0],[1,0]])
    fade.addColorStop(at,'rgba(0,0,0,'+opacity+')');
  m.fillStyle=fade;m.fillRect(0,0,w,h);
  const vertical=m.createLinearGradient(0,h*vy*.52,0,h*vy*.83);
  vertical.addColorStop(0,'transparent');vertical.addColorStop(1,'black');
  m.fillStyle=vertical;m.fillRect(0,0,w,h);
  brush.drawImage(middle,0,0);view.sky=plate;
  return view;
}

function drawScrollView(scene,view,center,artWidth,depth){
  const layout=scrollLayout[scene.id], edge=artWidth*.5;
  const minStride=Math.max(3,Math.ceil(W/(compactControls.matches ? 52 : 240)));
  ctx.save();
  for(const side of [-1,1]){
    const idx=side===-1?0:1, image=view.ribbons[idx];
    const period=image.width/2;
    const reach=side===-1?center:W-center;
    // A logarithmic scroll preserves the aspect of storefronts near the outer
    // edges. Its screen velocity still grows with distance from the horizon.
    const run=layout.length*edge*image.height/(period*ROAD_H*layout.heights[idx])*1.12;
    for(let u=edge*.038;u<reach;){
      const stride = u < edge*.2 ? minStride*2 : minStride;
      const r=(u+stride*.5)/edge;
      const z=layout.distance-run*Math.log(r);
      const metersPerStrip=run*stride/(r*edge);
      const sampleWidth=Math.min(period*.7,Math.max(.5,period*metersPerStrip/layout.length));
      // On the left depth increases to screen right; on the right it decreases.
      const along=-side*(travelMeters+z)/layout.length+idx*.37;
      const start=along*period-sampleWidth*.5;
      const sampleX=((start%period)+period)%period;
      const foot=roadEdgeY(u+stride*.5,artWidth,depth,roadside[scene.id].width);
      const height=ROAD_H*layout.heights[idx]*r;
      const x=side===-1?center-u-stride:center+u;
      ctx.globalAlpha=Math.min(1,Math.max(0,(r-.038)/.19));
      ctx.drawImage(image,sampleX,0,sampleWidth,image.height,x,foot-height,stride+.3,height+1);
      u += stride;
    }
  }
  ctx.restore();
}

function drawTourRoad(scene, paused) {
  const now=performance.now();
  if(activeRoad!==scene.id){
    const previousView=scrollViews[activeRoad];
    if(previousView){
      previousView.sky=null;
      previousView.ribbons=[];
      roadTiles.delete(activeRoad);
    }
    activeRoad=scene.id;travelMeters=0;previousRoadTime=now;
  }
  const dt=Math.min(.075,(now-previousRoadTime)/1000);
  previousRoadTime=now;
  if(!paused){
    travelMeters+=dt*18*gameSpeed;
    roadCurveTimer+=dt*60;
    if(roadCurveTimer>130){roadCurveTarget=(Math.random()-.5)*.55;roadCurveTimer=0;}
    roadCurve+=(roadCurveTarget-roadCurve)*(1-Math.exp(-.66*dt));
  }
  roadOffset=(travelMeters/12)%1;
  const art=routePictures[scene.id];
  const [vx,vy]=roadView[scene.id];
  const artWidth=Math.max(W*1.025,ROAD_H*1.45);
  const center=W*.5+(vx-.5)*artWidth-roadCurve*W*.025;
  VPY=ROAD_H*vy;
  const depth=ROAD_H-VPY;
  const distantScale=1+.23*(1-Math.exp(-travelMeters/620));
  const view=prepareScrollView(scene,art);
  ctx.drawImage(view.sky || art,center-artWidth*vx*distantScale,VPY-VPY*distantScale,
    artWidth*distantScale,ROAD_H*distantScale);
  const nearZ=4.4;
  if(view.sky) drawScrollView(scene,view,center,artWidth,depth);
  drawPassingPavement(scene,art,center,artWidth,depth,nearZ);
  const dashWidth=Math.min(12,artWidth*.008);
  for(let i=0;i<24;i++){
    const z=(i+1-roadOffset)*12;
    const near=Math.min(1,nearZ/z), far=Math.min(1,nearZ/(z+4.5));
    if(far>=near)continue;
    ctx.beginPath();
    for(const [t,side] of [[far,-1],[far,1],[near,1],[near,-1]]){
      ctx.lineTo(center+t*(side*dashWidth-W*.045),VPY+t*depth);
    }
    ctx.closePath();
    ctx.fillStyle='rgba(250,217,143,'+(.42+near*.46)+')';
    ctx.fill();
  }
  drawPassingScenery(scene,center,artWidth,depth,nearZ);
}


function drawTourDashboard(){
  const strip = Math.max(30,DASH_H*.23);
  const panel = DASH_H-strip;
  const art=cockpitPicture, sourceWidth=art.naturalWidth, sourceHeight=art.naturalHeight;
  // Stretch the flat side panels independently to preserve the steering wheel proportions.
  const centerSource=sourceWidth*.43;
  const centerWidth=Math.min(W*.47, panel*centerSource/sourceHeight);
  const sideSource=(sourceWidth-centerSource)/2, sideWidth=(W-centerWidth)/2;
  ctx.drawImage(art,0,0,sideSource,sourceHeight,0,ROAD_H,sideWidth+.5,panel);
  ctx.drawImage(art,sideSource,0,centerSource,sourceHeight,sideWidth,ROAD_H,centerWidth+.5,panel);
  ctx.drawImage(art,sideSource+centerSource,0,sideSource,sourceHeight,sideWidth+centerWidth,ROAD_H,sideWidth,panel);
  const r=Math.min(panel*.39,W*.105,55), cy=ROAD_H+panel*.51;
  drawGauge(W*.26,cy,r,displaySpeed*95,0,200,'km/h',160,'#bd5034');
  drawGauge(W*.74,cy,r,displaySpeed*3800,0,8000,'RPM',6500,'#bd5034');
  if (W>650) {
    ctx.font='bold '+Math.max(11,Math.round(r*.31))+'px Consolas,monospace';
    ctx.fillStyle='#fff0cd'; ctx.textAlign='center';ctx.textBaseline='middle';
    ctx.fillText(Math.round(displaySpeed*95)+' km/h',W*.15,cy);
    ctx.fillText('GEAR '+Math.max(1,Math.min(6,Math.round(displaySpeed*2.6))),W*.85,cy);
  }
  drawDashboardCar();
  if(warningFlash>0) warningFlash--;
}
