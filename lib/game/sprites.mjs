// Runtime pixel rendering. Source assets stay unchanged and versioned.
export function rasterizeFrame(ctx,image,atlas,cell){
 const width=ctx.canvas.width,height=ctx.canvas.height,sw=image.width/atlas.columns,sh=image.height/atlas.rows;
 ctx.imageSmoothingEnabled=false;ctx.drawImage(image,cell.column*sw,cell.row*sh,sw,sh,0,0,width,height);
 const pixels=ctx.getImageData(0,0,width,height),palette=atlas.palette?.map(hex=>[parseInt(hex.slice(1,3),16),parseInt(hex.slice(3,5),16),parseInt(hex.slice(5,7),16)]);
 let bottom=-1;
 for(let i=0;i<pixels.data.length;i+=4){
  if(pixels.data[i+3]<110){pixels.data[i+3]=0;continue;}
  if(palette){let best=palette[0],score=Infinity;for(const c of palette){const d=(pixels.data[i]-c[0])**2+(pixels.data[i+1]-c[1])**2+(pixels.data[i+2]-c[2])**2;if(d<score){score=d;best=c;}}pixels.data[i]=best[0];pixels.data[i+1]=best[1];pixels.data[i+2]=best[2];}
  pixels.data[i+3]=255;bottom=Math.max(bottom,Math.floor(i/4/width));
 }
 // Keep the main eight-connected silhouette; remove isolated alpha specks.
 const visited=new Uint8Array(width*height);let main=[];
 for(let root=0;root<visited.length;root++){if(visited[root]||!pixels.data[root*4+3])continue;const queue=[root];visited[root]=1;for(let head=0;head<queue.length;head++){const p=queue[head],x=p%width,y=Math.floor(p/width);for(let dy=-1;dy<=1;dy++)for(let dx=-1;dx<=1;dx++){const nx=x+dx,ny=y+dy;if(nx<0||nx>=width||ny<0||ny>=height)continue;const q=ny*width+nx;if(!visited[q]&&pixels.data[q*4+3]){visited[q]=1;queue.push(q);}}}if(queue.length>main.length)main=queue;}
 const keep=new Set(main);bottom=-1;for(let p=0;p<width*height;p++){if(!keep.has(p))pixels.data[p*4+3]=0;else bottom=Math.max(bottom,Math.floor(p/width));}
 const result=ctx.createImageData(width,height),offset=bottom<0?0:Math.round(height*(atlas.footAnchor?.[1]??.9))-bottom;
 for(let y=0;y<height;y++){const target=y+offset;if(target<0||target>=height)continue;result.data.set(pixels.data.subarray(y*width*4,(y+1)*width*4),target*width*4);}
 ctx.clearRect(0,0,width,height);ctx.putImageData(result,0,0);
}
