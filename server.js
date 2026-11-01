import express from 'express';
import { createServer } from 'node:http';
import { Server } from 'socket.io';
import { fileURLToPath } from 'node:url';
import { Dungeon, CLASSES, LEVELS } from './game.js';
import { randomBytes } from 'node:crypto';

export function createGameServer() {
  const app=express(),http=createServer(app),io=new Server(http,{maxHttpBufferSize:4096,pingTimeout:20000}),rooms=new Map();
  app.disable('x-powered-by');
  app.get('/health',(_req,res)=>res.json({ok:true,rooms:rooms.size}));
  app.get('/api/config',(_req,res)=>res.json({classes:CLASSES,levels:LEVELS}));
  const preview=new Dungeon('DEMO',41892);preview.addPlayer('demo','Little Fish','clown');
  app.get('/api/preview',(_req,res)=>res.json(preview.snapshot()));
  app.use(express.static(fileURLToPath(new URL('./public',import.meta.url)),{
    maxAge:process.env.NODE_ENV==='production'?'1h':0,
    setHeaders:(res,path)=>{if(path.endsWith('.html'))res.setHeader('Cache-Control','no-cache');},
  }));
  const announce=room=>io.to(room.code).emit('state',room.snapshot());
  const removePlayer=(room,id)=>{room.players.delete(id);if(room.hostId===id){const next=[...room.players.values()].find(p=>p.connected);if(next){room.hostId=next.id;io.to(next.id).emit('host');}}if(!room.players.size)rooms.delete(room.code);else announce(room);};
  const leave=socket=>{const room=rooms.get(socket.data.room);if(room){socket.leave(room.code);removePlayer(room,socket.id);}socket.data.room=null;};
  const session=(socket,room)=>{const p=room.players.get(socket.id);p.token=randomBytes(24).toString('hex');p.connected=true;socket.emit('session',{token:p.token});};
  io.on('connection',socket=>{
    socket.on('create',(data,reply)=>{
      if(typeof reply!=='function')return;
      if(rooms.size>=100){reply({error:'The ocean is busy. Try again shortly.'});return;}
      if(!data||!CLASSES[data.kind]){reply({error:'Choose a fish first.'});return;}
      leave(socket);let code;do{code=randomBytes(4).toString('hex').slice(0,5).toUpperCase();}while(rooms.has(code));
      const room=new Dungeon(code);room.private=data.solo===true;room.hostId=socket.id;room.addPlayer(socket.id,data.name,data.kind);rooms.set(code,room);socket.join(code);socket.data.room=code;session(socket,room);
      if(data.solo)room.start();reply({ok:true,code,id:socket.id,host:true});announce(room);
    });
    socket.on('join',(data,reply)=>{
      if(typeof reply!=='function')return;
      const room=rooms.get(String(data?.code||'').toUpperCase().trim());
      if(!room||room.private){reply({error:'Crew not found. Check the five-character code.'});return;}
      if(!CLASSES[data.kind]){reply({error:'Choose a fish first.'});return;}
      if(room.players.size>=4){reply({error:'This crew is full (4 fish maximum).'});return;}
      if(['victory','defeat'].includes(room.status)){reply({error:'This expedition has ended. Ask the captain to start again.'});return;}
      leave(socket);room.addPlayer(socket.id,data.name,data.kind);socket.join(room.code);socket.data.room=room.code;session(socket,room);if(room.status==='paused')room.status='playing';reply({ok:true,code:room.code,id:socket.id,host:false});announce(room);
    });
    socket.on('resume',(data,reply)=>{
      if(typeof reply!=='function')return;const room=rooms.get(String(data?.code||'').slice(0,5));
      const p=typeof data?.token==='string'?[...(room?.players.values()||[])].find(p=>p.token===data.token&&!p.connected):null;
      if(!room||!p){reply({error:'Expedition expired.'});return;}
      const oldId=p.id;room.players.delete(oldId);p.id=socket.id;p.connected=true;p.disconnectedAt=null;room.players.set(socket.id,p);if(room.hostId===oldId)room.hostId=socket.id;socket.join(room.code);socket.data.room=room.code;reply({ok:true,id:socket.id,host:room.hostId===socket.id});announce(room);
    });
    socket.on('start',()=>{const room=rooms.get(socket.data.room);if(room&&room.hostId===socket.id){room.start();announce(room);}});
    socket.on('restart',()=>{const room=rooms.get(socket.data.room);if(room&&room.hostId===socket.id&&['defeat','victory'].includes(room.status)){room.restart();announce(room);}});
    socket.on('pause',()=>{const room=rooms.get(socket.data.room);if(room&&room.hostId===socket.id&&room.players.size===1&&['playing','paused'].includes(room.status)){room.status=room.status==='paused'?'playing':'paused';announce(room);}});
    socket.on('input',data=>rooms.get(socket.data.room)?.input(socket.id,data));
    socket.on('leave',()=>leave(socket));
    socket.on('disconnect',()=>{const p=rooms.get(socket.data.room)?.players.get(socket.id);if(p){p.connected=false;p.disconnectedAt=Date.now();p.input={};}});
  });
  let previous=performance.now(),frames=0;
  const timer=setInterval(()=>{
    const now=performance.now(),dt=Math.min((now-previous)/1000,.05);previous=now;
    for(const room of rooms.values()){
      for(const p of room.players.values())if(!p.connected&&p.disconnectedAt&&Date.now()-p.disconnectedAt>30000)removePlayer(room,p.id);
      if([...room.players.values()].some(p=>p.connected))room.tick(dt);
    }
    if(++frames%2===0)for(const room of rooms.values())if(room.status==='playing')announce(room);
    // End states are sent once immediately after the simulation changes status.
    for(const room of rooms.values())if(room.lastStatus!==room.status){room.lastStatus=room.status;announce(room);}
  },1000/30);
  return {app,http,io,rooms,close:()=>{clearInterval(timer);io.close();http.close();}};
}

if(process.argv[1]===fileURLToPath(import.meta.url)) {
  const {http}=createGameServer();const port=Number(process.env.PORT)||3000;
  http.listen(port,'0.0.0.0',()=>console.log(`Tidebound is ready at http://localhost:${port}`));
}
