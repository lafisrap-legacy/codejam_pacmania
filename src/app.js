
var PM_PacBallSize = 300,
	PM_GRABABLE_MASK_BIT = 1<<31,
	PM_NOT_GRABABLE_MASK = PM_GRABABLE_MASK_BIT,
	PM_COLL_TYPE_STATIC = 1,
	PM_COLL_TYPE_OBJECT = 2,
    PM_Space = null,
    PM_BallColors = [
        cc.color(100,0,0),        cc.color(0,0,100),
        cc.color(0,100,0),
        cc.color(100,100,0),
        cc.color(100,0,100),
    ],
    PM_CapNames = ["berlin", "chimay", "guiness", "leffe", "roch", "wine"];

var PacBall = cc.PhysicsSprite.extend({

	_space: null,
	_pacball: null,
	_shape: null,
    _size: 0.2,
    _capName: "",

	// ctor calls the parent class with appropriate parameter
    ctor: function(pos, rotation, cap) {
        cc.PhysicsSprite.prototype.ctor.call(this);
        
		var capName = this._capName = PM_CapNames[cap],
            frame = cc.spriteFrameCache.getSpriteFrame(capName+"2.png");

        this.initWithSpriteFrame(frame);
		this.setAnchorPoint(0.50,0.50);
		var radius = PM_PacBallSize * this._size / 2,
			mass = 100,
			pb = this._pacball = PM_Space.addBody(new cp.Body(mass, cp.momentForCircle(mass, 0, radius, cp.v(0, 0)))),
			circle = this._shape = PM_Space.addShape(new cp.CircleShape(pb, radius, cp.v(0, 0)));
		circle.setElasticity(1);
		circle.setFriction(0);		
		circle.setCollisionType(PM_COLL_TYPE_OBJECT);

		this.setBody(pb);
        this.setPosition(pos);
        //this.setColor(color);
        this.setScale(this._size);
        this.setRotation(rotation);
	},
});
	

var PacManiaLayer = cc.Layer.extend({
    _space: null,
    _pacBalls: {}, 
    _newLeftKey: null,
    _colorId: 0,

    ctor:function () {
        //////////////////////////////
        // 1. super init first
        this._super();
        var self = this;

        cc.width  = cc.winSize.width;
        cc.height = cc.winSize.height;

		// Create the initial chipmonk space
        var sp = PM_Space = new cp.Space();
		sp.iterations = 60;
        sp.gravity = cp.v(0, 0);
        sp.sleepTimeThreshold = 0.5;
        sp.collisionSlop = 0.5;

	    cc.spriteFrameCache.addSpriteFrames(res.caps_plist);

        this.addWorldObjects();
		
        this.scheduleUpdate();
        //this.initListeners();

        var table = new cc.Sprite(cc.spriteFrameCache.getSpriteFrame("wood.jpg"));
        table.setPosition(cc.width/2, cc.height/2);
        this.addChild(table,0);

        $WS.connect("ws://192.168.2.236:4022/socket", function() {
            $WS.sendMessage({
                Command: "connectPlayground"
            }, function(message) {
                cc.log(message);
            });
        }, function(message) {
            var pid = message.Pid,
                ball = self._pacBalls[pid];

            switch(message.Command) {
                case "JumpIn": 
                    var rot = Math.floor(Math.random()*360-180);

                    self._colorId = (++self._colorId) % PM_BallColors.length;
                    self.addPacBall(pid, cc.p(400,225), Math.random()*360, PM_BallColors[self._colorId]);

                    var ball = self._pacBalls[pid];
                    ball.shouldBeRotation = rot;
                    break;
                case "leftButtonDown":
                    ball.keyLeftPressed = true;
                    break;
                case "leftButtonUp":
                    ball.keyLeftPressed = false;
                    break;
                case "rightButtonDown":
                    ball.keyRightPressed = true;
                    break;
                case "rightButtonUp":
                    ball.keyRightPressed = false;
                    break;
            }
        });

        return true;
    },

    addPacBall: function(pid, pos, rotation) {

        cap = pid%PM_CapNames.length;

        var pb = new PacBall(pos, rotation, cap);

        pb._pid = pid;
		pb.getBody().applyImpulse(cp.v( Math.sin(PM_rad(rotation))*2000, Math.cos(PM_rad(rotation))*2000 ),cp.v(0,0));
        this._pacBalls[pid] = pb;
        this.addChild(pb);
    },

    removePacBall: function(pid) {
        PM_Space.removeBody(this._pacBalls[pid].getBody());
        this.removeChild(this._pacBalls[pid]);
        delete this._pacBalls[pid];
        $WS.sendMessage({
            Command: "throwOut",
            Pid: pid, 
        });
    },

    rotate: function(pacBall, amount) {
        var vel = pacBall.getBody().getVel(),
            rad = Math.atan2(vel.x, vel.y),
            radius = vel.y / Math.cos(rad),
            rot = PM_deg(rad);

        rot += amount;
        if( rot < -180 ) rot += 360;
        if( rot >  180 ) rot -= 360;

        vel.x = Math.sin(PM_rad(rot)) * radius;
        vel.y = Math.cos(PM_rad(rot)) * radius;

        pacBall.getBody().setVel(vel);
        pacBall.shouldBeRotation = rot; 
    },

    update : function(dt) {
        var pbs = this._pacBalls;

        PM_Space.step(dt);
        
        for( var pid in pbs ) {

            var ball = pbs[pid];

            var vel = ball.getBody().getVel(),
                speed = Math.sqrt(vel.x*vel.x+vel.y*vel.y);
        
            // speed balls up!
            if( speed < 100 ) {
                var rot = ball.getRotation(),
                    x = Math.sin(PM_rad(rot)) * 1,
                    y = Math.cos(PM_rad(rot)) * 1;

                vel.x += x;
                vel.y += y;
                ball.getBody().setVel(vel);
            }

            // slow them down or rotate them with keys
            if( ball.keyLeftPressed && ball.keyRightPressed ) {
                vel.x *= 0.9;
                vel.y *= 0.9;
                ball.getBody().setVel(vel); 
            } else if( ball.keyLeftPressed ) {
                this.rotate(ball, -4);
            } else if( ball.keyRightPressed ) {
                this.rotate(ball,  4);
            }

            // rotate them automatically
            var rot = ball.getRotation();
            if(  ball.shouldBeRotation != rot ) {
                var dist = Math.abs( ball.shouldBeRotation - rot ),
                    dir = ball.shouldBeRotation < ball.getRotation()? -1:1;

                if( dist > 180 ) dir = -dir;
                if( dist < 5 ) rot = ball.shouldBeRotation;
                else rot += 5 * dir;

                if( rot > 180 ) rot -= 360;
                if( rot < -180 ) rot += 360;

                ball.setRotation(rot);
            } 
        }
    },

    // chipmonk addons
	addWorldObjects: function() {
        var self = this,
            space = PM_Space;

		var addwo = function(from, to, thinkness) {
		    var obj = space.addShape(new cp.SegmentShape(space.staticBody, from, to, thinkness || 0));
		    obj.setElasticity(0.9);
		    obj.setFriction(0.1);
		    obj.setLayers(PM_NOT_GRABABLE_MASK);
		    obj.setCollisionType(PM_COLL_TYPE_STATIC);
		}

        // box surrounding the playfield
		addwo(cp.v(  0,  0), cp.v(800,  0));
		addwo(cp.v(800,  0), cp.v(800,450));
		addwo(cp.v(800,450), cp.v(  0,450));
		addwo(cp.v(  0,450), cp.v(  0,  0));

        var correctRotation = function(arb) {
            var pbs = self._pacBalls;
            for( ballId in pbs ) {
                var ball = pbs[ballId];

                if( arb.body_a === ball.getBody()) {
                    var vel = arb.body_a.getVel(),
                        newAngle = PM_deg( Math.atan2(vel.x, vel.y) );

                    ball.shouldBeRotation = newAngle;
                }
                if( arb.body_b === ball.getBody()) {
                    var vel = arb.body_b.getVel(),
                        newAngle = PM_deg( Math.atan2(vel.x, vel.y) );
                    
                    ball.shouldBeRotation = newAngle;
                }
            }
        };

        var checkCollision = function(body, cPos, pacBall) {

            if( body === pacBall.getBody()) {
                var pos = pacBall.getPosition(),
                    rot = pacBall.getRotation(),
                    angle = PM_deg( Math.atan2(cPos.x - pos.x, cPos.y - pos.y) );

                if( Math.abs(angle - rot) < 45 ) {
                    pacBall.runAction(
                        cc.sequence(
                            cc.EaseSineIn.create(cc.scaleTo(0.3,pacBall._size * 1.3)),
                            cc.callFunc(function() {
                                pacBall._size *= 1.2;
                                if( pacBall._size > 0.5 ) pacBall._size = 0.5;

                                var radius = PM_PacBallSize * pacBall._size / 2;
                                PM_Space.removeShape(pacBall._shape);
                                circle = pacBall._shape = PM_Space.addShape(new cp.CircleShape(pacBall.getBody(), radius, cp.v(0, 0)));
                                circle.setElasticity(1);
                                circle.setFriction(0);      
                                circle.setCollisionType(PM_COLL_TYPE_OBJECT);

                                frameId = pacBall._size < 0.1? 1 : pacBall._size < 0.35? 2 : 3;
                                var frame = cc.spriteFrameCache.getSpriteFrame(pacBall._capName+frameId+".png");
                                pacBall.setSpriteFrame(frame);

                                pacBall.runAction(cc.EaseSineOut.create(cc.scaleTo(0.3, pacBall._size)));
                            })
                        )
                    );
                } else {
                    pacBall.runAction(
                        cc.sequence(
                            cc.EaseSineIn.create(cc.scaleTo(0.3,pacBall._size / 1.3)),
                            cc.callFunc(function() {
                                pacBall._size /= 1.2;
                                if( pacBall._size < 0.05 ) {
                                    pacBall._size = 0.05;
                                    self.removePacBall( pacBall._pid );
                                }

                                var radius = PM_PacBallSize * pacBall._size / 2;
                                PM_Space.removeShape(pacBall._shape);
                                circle = pacBall._shape = PM_Space.addShape(new cp.CircleShape(pacBall.getBody(), radius, cp.v(0, 0)));
                                circle.setElasticity(1);
                                circle.setFriction(0);      
                                circle.setCollisionType(PM_COLL_TYPE_OBJECT);

                                frameId = pacBall._size < 0.1? 1 : pacBall._size < 0.35? 2 : 3;
                                var frame = cc.spriteFrameCache.getSpriteFrame(pacBall._capName+frameId+".png");
                                pacBall.setSpriteFrame(frame);

                                pacBall.runAction(cc.EaseSineOut.create(cc.scaleTo(0.3, pacBall._size)));
                            })
                        )
                    );
                }
            }
        };

		space.addCollisionHandler(PM_COLL_TYPE_OBJECT,PM_COLL_TYPE_OBJECT,function(arb, space, data) {
            var pbs = self._pacBalls,
                cPos = arb.contacts[0].p;

            for( ballId in pbs ) {
                var ball = pbs[ballId];

                checkCollision(arb.body_a, cPos, ball);
                checkCollision(arb.body_b, cPos, ball);
            }

            //cc.log(arb.contacts);
            return true;
        }, null, function(arb, space, data) {
            correctRotation( arb );
			
            return true;
		}, null);	

		space.addCollisionHandler(PM_COLL_TYPE_OBJECT,PM_COLL_TYPE_STATIC,null, null, function(arb, space, data) {
            correctRotation( arb );

			return true;
		}, null);	
    },
});

var PacManiaScene = cc.Scene.extend({
    onEnter:function () {
        this._super();
        var layer = new PacManiaLayer();
        this.addChild(layer);
    }
});

var PM_rad = function(angle) {
      return angle * (Math.PI / 180);
};

var PM_deg = function(angle) {
      return angle * (180 / Math.PI);
};
