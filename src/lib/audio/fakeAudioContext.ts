/*
 * テスト専用の AudioContext スタブ(アプリからは import しない)。
 *
 * jsdom には Web Audio API がないため、SpatialAudioEngine の検証はこの偽の
 * コンテキストで行う。生成されたノードと設定値を記録し、どんなグラフが
 * 組まれたかをテストから確認できるようにしてある。
 *
 * legacy: true にすると AudioParam 方式の position / forward を持たない
 * 古い実装(setPosition / setOrientation のみ)を再現する。
 */

export type FakeParamCall = { method: string; value: number };

export class FakeAudioParam {
	value: number;
	readonly calls: FakeParamCall[] = [];

	constructor(value = 0) {
		this.value = value;
	}

	setTargetAtTime(value: number) {
		this.value = value;
		this.calls.push({ method: 'setTargetAtTime', value });
		return this;
	}

	setValueAtTime(value: number) {
		this.value = value;
		this.calls.push({ method: 'setValueAtTime', value });
		return this;
	}

	linearRampToValueAtTime(value: number) {
		this.calls.push({ method: 'linearRampToValueAtTime', value });
		return this;
	}

	cancelScheduledValues() {
		this.calls.push({ method: 'cancelScheduledValues', value: this.value });
		return this;
	}
}

class FakeNode {
	readonly connections: unknown[] = [];
	disconnected = 0;

	connect(target: unknown) {
		this.connections.push(target);
		return target;
	}

	disconnect() {
		this.disconnected += 1;
	}
}

class FakeScheduledNode extends FakeNode {
	started = 0;
	stopped = 0;

	start() {
		this.started += 1;
	}

	stop() {
		this.stopped += 1;
	}
}

export class FakeGainNode extends FakeNode {
	gain = new FakeAudioParam(1);
}

export class FakeOscillatorNode extends FakeScheduledNode {
	type = 'sine';
	frequency = new FakeAudioParam(440);
}

export class FakeBufferSourceNode extends FakeScheduledNode {
	buffer: unknown = null;
	loop = false;
}

export class FakeBiquadFilterNode extends FakeNode {
	type = 'lowpass';
	frequency = new FakeAudioParam(350);
	Q = new FakeAudioParam(1);
}

export class FakeConvolverNode extends FakeNode {
	buffer: unknown = null;
}

export class FakePannerNode extends FakeNode {
	panningModel = 'equalpower';
	distanceModel = 'inverse';
	refDistance = 1;
	maxDistance = 10000;
	rolloffFactor = 1;
	positionX?: FakeAudioParam;
	positionY?: FakeAudioParam;
	positionZ?: FakeAudioParam;
	legacyPosition: { x: number; y: number; z: number } | null = null;

	constructor(legacy: boolean) {
		super();
		if (legacy) return;
		this.positionX = new FakeAudioParam();
		this.positionY = new FakeAudioParam();
		this.positionZ = new FakeAudioParam();
	}

	setPosition(x: number, y: number, z: number) {
		this.legacyPosition = { x, y, z };
	}
}

class FakeAudioListener {
	positionX?: FakeAudioParam;
	positionY?: FakeAudioParam;
	positionZ?: FakeAudioParam;
	forwardX?: FakeAudioParam;
	forwardY?: FakeAudioParam;
	forwardZ?: FakeAudioParam;
	upX?: FakeAudioParam;
	upY?: FakeAudioParam;
	upZ?: FakeAudioParam;
	legacyPosition: { x: number; y: number; z: number } | null = null;
	legacyOrientation: number[] | null = null;

	constructor(legacy: boolean) {
		if (legacy) return;
		this.positionX = new FakeAudioParam();
		this.positionY = new FakeAudioParam();
		this.positionZ = new FakeAudioParam();
		this.forwardX = new FakeAudioParam();
		this.forwardY = new FakeAudioParam();
		this.forwardZ = new FakeAudioParam(-1);
		this.upX = new FakeAudioParam();
		this.upY = new FakeAudioParam(1);
		this.upZ = new FakeAudioParam();
	}

	setPosition(x: number, y: number, z: number) {
		this.legacyPosition = { x, y, z };
	}

	setOrientation(...values: number[]) {
		this.legacyOrientation = values;
	}
}

export class FakeAudioContext {
	readonly sampleRate = 48000;
	currentTime = 0;
	state: AudioContextState = 'running';
	readonly destination = new FakeNode();
	readonly listener: FakeAudioListener;
	readonly panners: FakePannerNode[] = [];
	readonly oscillators: FakeOscillatorNode[] = [];
	readonly bufferSources: FakeBufferSourceNode[] = [];
	readonly gains: FakeGainNode[] = [];
	readonly convolvers: FakeConvolverNode[] = [];
	closed = 0;
	suspended = 0;
	resumed = 0;

	readonly #legacy: boolean;

	constructor(options: { legacy?: boolean; state?: AudioContextState } = {}) {
		this.#legacy = options.legacy ?? false;
		this.state = options.state ?? 'running';
		this.listener = new FakeAudioListener(this.#legacy);
	}

	createGain() {
		const node = new FakeGainNode();
		this.gains.push(node);
		return node;
	}

	createOscillator() {
		const node = new FakeOscillatorNode();
		this.oscillators.push(node);
		return node;
	}

	createBufferSource() {
		const node = new FakeBufferSourceNode();
		this.bufferSources.push(node);
		return node;
	}

	createBiquadFilter() {
		return new FakeBiquadFilterNode();
	}

	createConvolver() {
		const node = new FakeConvolverNode();
		this.convolvers.push(node);
		return node;
	}

	createPanner() {
		const node = new FakePannerNode(this.#legacy);
		this.panners.push(node);
		return node;
	}

	createBuffer(numberOfChannels: number, length: number, sampleRate: number) {
		const channels = Array.from({ length: numberOfChannels }, () => new Float32Array(length));
		return {
			numberOfChannels,
			length,
			sampleRate,
			getChannelData: (index: number) => channels[index]
		};
	}

	async resume() {
		this.resumed += 1;
		this.state = 'running';
	}

	async suspend() {
		this.suspended += 1;
		this.state = 'suspended';
	}

	async close() {
		this.closed += 1;
		this.state = 'closed';
	}
}

/** SpatialAudioEngine に渡すための型合わせ(実体は FakeAudioContext) */
export const asAudioContext = (context: FakeAudioContext): AudioContext =>
	context as unknown as AudioContext;
