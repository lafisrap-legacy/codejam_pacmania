
var PM_PacBallSize = 300,
	PM_GRABABLE_MASK_BIT = 1<<31,
	PM_NOT_GRABABLE_MASK = PM_GRABABLE_MASK_BIT,
	PM_COLL_TYPE_STATIC = 1,
	PM_COLL_TYPE_OBJECT = 2,
    PM_Space = null,
    PM_BallColors = [
        cc.color(100,0,0),
        cc.color(0,0,100),
        cc.color(0,100,0),
        cc.color(100,100,0),
        cc.color(100,0,100),
    ];

var PacBall = cc.PhysicsSprite.extend({

	_space: null,
	_pacball: null,
	_shape: null,
    _size: 0.2,

	// ctor calls the parent class with appropriate parameter
    ctor: function(pos, rotation, color) {
        cc.PhysicsSprite.prototype.ctor.call(this);
        
		var frame = cc.spriteFrameCache.getSpriteFrame("pacball.png");
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
        this.setColor(color);
        this.setScale(this._size);
        this.setRotation(rotation);
	},
});
	

var PacManiaLayer = cc.Layer.extend({
    _space: null,
    _pacBalls: [], 
    _newLeftKey: null,
    _colorId: 0,

    ctor:function () {
        //////////////////////////////
        // 1. super init first
        this._super();

        cc.width  = cc.winSize.width;
        cc.height = cc.winSize.height;

		// Create the initial chipmonk space
        var sp = PM_Space = new cp.Space();
		sp.iterations = 60;
        sp.gravity = cp.v(0, 0);
        sp.sleepTimeThreshold = 0.5;
        sp.collisionSlop = 0.5;

	    cc.spriteFrameCache.addSpriteFrames(res.pacmania_plist);

        this.addWorldObjects();
		
        this.scheduleUpdate();
        this.initListeners();
        return true;
    },

    addPacBall: function(pos, rotation, color) {
        var pb = new PacBall(pos, rotation, color);

		pb.getBody().applyImpulse(cp.v( Math.sin(PM_rad(rotation))*2000, Math.cos(PM_rad(rotation))*2000 ),cp.v(0,0));
        this._pacBalls.push(pb);
        this.addChild(pb);
    },

    initListeners: function() {
        var self = this;
        this._keyboardListener = cc.EventListener.create({
            event: cc.EventListener.KEYBOARD,
            onKeyPressed:function(key, event) {
                var pbs = self._pacBalls,
                    consumed = false;
                for( var i=0 ; i<pbs.length ; i++ ) {
                    if( pbs[i].keyLeft === key ) {
                        pbs[i].keyLeftPressed = true;
                        consumed = true;
                    }
                    else if( pbs[i].keyRight === key ) {
                        pbs[i].keyRightPressed = true;
                        consumed = true;
                    }
                }
                if( !consumed ) {
                    if( !self._newLeftKey ) self._newLeftKey = key;
                    else {
                        var rot = Math.floor(Math.random()*360-180);
                        self._colorId = (++self._colorId) % PM_BallColors.length;
                        self.addPacBall(cc.p(400,225), Math.random()*360, PM_BallColors[self._colorId]);
                        pbs[i].keyLeft = self._newLeftKey;
                        pbs[i].keyRight = key;
                        pbs[i].shouldBeRotation = rot;
                        self._newLeftKey = null;
                    }
                }
            },
            onKeyReleased:function(key, event) {
                var pbs = self._pacBalls;
                for( var i=0 ; i<pbs.length ; i++ ) {
                    if( pbs[i].keyLeft === key ) {
                        pbs[i].keyLeftPressed = false;
                    }
                    else if( pbs[i].keyRight === key ) {
                        pbs[i].keyRightPressed = false;
                    }
                }
            }
        }, this);
        
        cc.eventManager.addListener(this._keyboardListener, this);
    },
    
    //////////////////////////////////////////////////////////////////////////////////////
    // Stopps touch and keyboard events
    //
    stopListeners: function() {
        if( this._touchListener ) cc.eventManager.removeListener(this._touchListener);
        if( this._keyboardListener ) cc.eventManager.removeListener(this._keyboardListener);
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
        
        for( var i=0 ; i<pbs.length ; i++ ) {
            var vel = pbs[i].getBody().getVel(),
                speed = Math.sqrt(vel.x*vel.x+vel.y*vel.y);
        
            // speed balls up!
            if( speed < 100 ) {
                var rot = pbs[i].getRotation(),
                    x = Math.sin(PM_rad(rot)) * 1,
                    y = Math.cos(PM_rad(rot)) * 1;

                vel.x += x;
                vel.y += y;
                pbs[i].getBody().setVel(vel);
            }

            // slow them down or rotate them with keys
            if( pbs[i].keyLeftPressed && pbs[i].keyRightPressed ) {
                vel.x *= 0.9;
                vel.y *= 0.9;
                pbs[i].getBody().setVel(vel); 
            } else if( pbs[i].keyLeftPressed ) {
                this.rotate(pbs[i], -4);
            } else if( pbs[i].keyRightPressed ) {
                this.rotate(pbs[i],  4);
            }

            // rotate them automatically
            var rot = pbs[i].getRotation();
            if(  pbs[i].shouldBeRotation != rot ) {
                var dist = Math.abs( pbs[i].shouldBeRotation - rot ),
                    dir = pbs[i].shouldBeRotation < pbs[i].getRotation()? -1:1;

                if( dist > 180 ) dir = -dir;
                if( dist < 5 ) rot = pbs[i].shouldBeRotation;
                else rot += 5 * dir;

                if( rot > 180 ) rot -= 360;
                if( rot < -180 ) rot += 360;

                pbs[i].setRotation(rot);
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
            for( var i=0 ; i<pbs.length ; i++ ) {
                if( arb.body_a === pbs[i].getBody()) {
                    var vel = arb.body_a.getVel(),
                        newAngle = PM_deg( Math.atan2(vel.x, vel.y) );

                    pbs[i].shouldBeRotation = newAngle;
                }
                if( arb.body_b === pbs[i].getBody()) {
                    var vel = arb.body_b.getVel(),
                        newAngle = PM_deg( Math.atan2(vel.x, vel.y) );
                    
                    pbs[i].shouldBeRotation = newAngle;
                }
            }
        };

        var checkCollision = function(body, cPos, pacBall) {

            if( body === pacBall.getBody()) {
                var pos = pacBall.getPosition(),
                    rot = pacBall.getRotation(),
                    angle = PM_deg( Math.atan2(cPos.x - pos.x, cPos.y - pos.y) );

                if( Math.abs(angle - rot) < 45 ) {
                    cc.log("HIT!");
                    pacBall.runAction(
                        cc.sequence(
                            cc.EaseSineIn.create(cc.scaleTo(0.3,pacBall._size * 1.3)),
                            cc.EaseSineOut.create(cc.scaleTo(0.3, pacBall._size))
                        )
                    );
                }
            }
        };

		space.addCollisionHandler(PM_COLL_TYPE_OBJECT,PM_COLL_TYPE_OBJECT,function(arb, space, data) {
            var pbs = self._pacBalls,
                cPos = arb.contacts[0].p;

            for( var i=0 ; i<pbs.length ; i++ ) {
                checkCollision(arb.body_a, cPos, pbs[i]);
                checkCollision(arb.body_b, cPos, pbs[i]);
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
