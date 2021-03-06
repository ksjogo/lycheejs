
lychee.define('game.state.Game').requires([
	'lychee.effect.Color',
	'lychee.effect.Shake',
	'lychee.ui.entity.Label',
	'game.entity.Ball',
	'game.entity.Paddle',
	'game.ui.sprite.Background',
	'game.ui.sprite.Welcome'
]).includes([
	'lychee.app.State'
]).exports(function(lychee, global, attachments) {

	const _Color  = lychee.import('lychee.effect.Color');
	const _Shake  = lychee.import('lychee.effect.Shake');
	const _State  = lychee.import('lychee.app.State');
	const _BLOB   = attachments["json"].buffer;
	const _MUSIC  = attachments["music.msc"];
	const _SOUNDS = {
		boo:   attachments["boo.snd"],
		cheer: attachments["cheer.snd"],
		ping:  attachments["ping.snd"],
		pong:  attachments["pong.snd"]
	};



	/*
	 * HELPERS
	 */

	const _on_touch = function(id, position, delta) {

		let renderer = this.renderer;
		if (renderer !== null) {

			position.y -= renderer.offset.y;
			position.y -= renderer.height / 2;

		}


		this.__player.target.y = position.y;

	};

	const _reset_game = function(winner) {

		winner = typeof winner === 'string' ? winner : null;


		let ball = this.queryLayer('game', 'ball');
		if (ball !== null) {

			let position = {
				x: 0,
				y: 0
			};

			let velocity = {
				x: 150 + Math.random() * 100,
				y: 100 + Math.random() * 100
			};

			if (Math.random() > 0.5) {
				velocity.y *= -1;
			}

			if (winner === 'player') {
				velocity.x *= -1;
			}

			ball.setPosition(position);
			ball.setVelocity(velocity);

		}


		if (winner === 'player') {
			this.jukebox.play(_SOUNDS.cheer);
		} else if (winner === 'enemy') {
			this.jukebox.play(_SOUNDS.boo);
		}


		let score = this.queryLayer('ui', 'score');
		if (score !== null) {
			score.setValue(this.__score.player + ' - ' + this.__score.enemy);
		}


		this.queryLayer('game', 'player').setPosition({ y: 0 });
		this.queryLayer('game', 'enemy').setPosition({ y: 0 });

	};



	/*
	 * IMPLEMENTATION
	 */

	let Composite = function(main) {

		_State.call(this, main);


		this.__ai = {
			clock:  null,
			delta:  500,
			target: { y: 0 }
		};

		this.__player = {
			target: { y: 0 }
		};

		this.__score = {
			player: 0,
			enemy:  0
		};


		this.deserialize(_BLOB);



		/*
		 * INITIALIZATION
		 */

		let viewport = this.viewport;
		if (viewport !== null) {

			viewport.bind('reshape', function(orientation, rotation) {

				let renderer = this.renderer;
				if (renderer !== null) {

					let entity = null;
					let width  = renderer.width;
					let height = renderer.height;


					entity = this.queryLayer('bg', 'background');
					entity.width  = width;
					entity.height = height;

					entity = this.queryLayer('ui', 'score');
					entity.setPosition({
						x: 0,
						y: -1/2 * height + 42
					});

					entity = this.queryLayer('game', 'player');
					entity.setPosition({ x: -1/2 * width + 42 });

					entity = this.queryLayer('game', 'enemy');
					entity.setPosition({ x:  1/2 * width - 42 });

				}

			}, this);

		}

	};


	Composite.prototype = {

		/*
		 * STATE API
		 */

		// deserialize: function(blob) {},

		serialize: function() {

			let data = _State.prototype.serialize.call(this);
			data['constructor'] = 'game.state.Game';


			return data;

		},

		enter: function(oncomplete) {

			this.__score.enemy  = 0;
			this.__score.player = 0;
			this.__ai.target.y  = 0;


			_reset_game.call(this, null);


			// Allow AI playing while welcome dialog is visible

			let welcome = this.queryLayer('ui', 'welcome');
			if (welcome !== null) {

				welcome.setVisible(true);
				welcome.bind('#touch', function(entity) {

					this.__score.enemy  = 0;
					this.__score.player = 0;
					this.__ai.target.y  = 0;

					_reset_game.call(this, null);

					entity.setVisible(false);

					this.input.bind('touch', _on_touch, this);

				}, this, true);

			}


			let jukebox = this.jukebox;
			if (jukebox !== null) {
				jukebox.play(_MUSIC);
			}


			_State.prototype.enter.call(this, oncomplete);

		},

		leave: function(oncomplete) {

			this.input.unbind('touch', _on_touch, this);


			let jukebox = this.jukebox;
			if (jukebox !== null) {
				jukebox.stop(_MUSIC);
			}


			_State.prototype.leave.call(this, oncomplete);

		},

		update: function(clock, delta) {

			_State.prototype.update.call(this, clock, delta);


			let jukebox    = this.jukebox;
			let renderer   = this.renderer;
			let background = this.queryLayer('bg', 'background');
			let gamelayer  = this.getLayer('game');
			let uilayer    = this.getLayer('ui');

			let ball     = this.queryLayer('game', 'ball');
			let player   = this.queryLayer('game', 'player');
			let enemy    = this.queryLayer('game', 'enemy');
			let hwidth   = renderer.width / 2;
			let hheight  = renderer.height / 2;
			let position = ball.position;
			let velocity = ball.velocity;


			/*
			 * 1: WORLD BOUNDARIES
			 */

			if (position.y > hheight && velocity.y > 0) {
				position.y = hheight - 1;
				velocity.y = -1 * velocity.y;
			}

			if (position.y < -hheight && velocity.y < 0) {
				position.y = -hheight + 1;
				velocity.y = -1 * velocity.y;
			}


			if (position.x > hwidth) {
				this.__score.player++;
				_reset_game.call(this, 'player');
				return;
			} else if (position.x < -hwidth) {
				this.__score.enemy++;
				_reset_game.call(this, 'enemy');
				return;
			}



			/*
			 * 2: COLLISIONS
			 */

			if (ball.collidesWith(player) === true) {

				position.x = player.position.x + 24;
				velocity.x = Math.abs(velocity.x);
				jukebox.play(_SOUNDS.ping);

				gamelayer.addEffect(new _Shake({
					type:     _Shake.TYPE.bounceeaseout,
					duration: 300,
					shake:    {
						x: (Math.random() * 16) | 0,
						y: (Math.random() * 16) | 0
					}
				}));

				uilayer.addEffect(new _Shake({
					type:     _Shake.TYPE.bounceeaseout,
					duration: 300,
					shake:    {
						x: (Math.random() * 16) | 0,
						y: (Math.random() * 16) | 0
					}
				}));

				background.setColor('#14a5e2');
				background.addEffect(new _Color({
					type:     _Color.TYPE.linear,
					duration: 1000,
					color:    '#050a0d'
				}));

			} else if (ball.collidesWith(enemy) === true) {

				position.x = enemy.position.x - 24;
				velocity.x = -1 * Math.abs(velocity.x);
				jukebox.play(_SOUNDS.pong);

				gamelayer.addEffect(new _Shake({
					type:     _Shake.TYPE.bounceeaseout,
					duration: 300,
					shake:    {
						x: (Math.random() * 16) | 0,
						y: (Math.random() * 16) | 0
					}
				}));

				uilayer.addEffect(new _Shake({
					type:     _Shake.TYPE.bounceeaseout,
					duration: 300,
					shake:    {
						x: (Math.random() * 16) | 0,
						y: (Math.random() * 16) | 0
					}
				}));

				background.setColor('#de1010');
				background.addEffect(new _Color({
					type:     _Color.TYPE.easeout,
					duration: 1000,
					color:    '#050a0d'
				}));

			}



			/*
			 * 3: AI LOGIC
			 */

			let ai = this.__ai;

			if (ai.clock === null) {
				ai.clock = clock;
			}

			if ((clock - ai.clock) > ai.delta) {

				ai.target.y = position.y;
				ai.clock    = clock;

				if (ai.target.y > enemy.position.y - 10 && ai.target.y < enemy.position.y + 10) {

					ai.target.y = enemy.position.y;
					enemy.setVelocity({ y: 0 });

				} else {

					if (ai.target.y > enemy.position.y - 10) {
						enemy.setVelocity({ y:  200 });
					}

					if (ai.target.y < enemy.position.y + 10) {
						enemy.setVelocity({ y: -200 });
					}

				}

			}



			/*
			 * 4: PLAYER LOGIC
			 */

			let target = this.__player.target;
			if (target.y !== null) {

				if (target.y > player.position.y - 10 && target.y < player.position.y + 10) {

					player.setVelocity({ y: 0 });
					target.y = null;

				} else {

					if (target.y > player.position.y - 10) {
						player.setVelocity({ y:  250 });
					}

					if (target.y < player.position.y + 10) {
						player.setVelocity({ y: -250 });
					}

				}

			}

		}

	};


	return Composite;

});
