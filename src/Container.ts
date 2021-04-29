import EventDispatcher, { DispatchableEvent } from './EventDispatcher';
import debounce from './util/debounce';
import getScrollContainerDimensions from './util/getScrollContainerDimensions';
import getScrollPos from './util/getScrollPos';
import registerEvent from './util/registerEvent';
import throttleRaf from './util/throttleRaf';
import { isWindow } from './util/typeguards';

export type ScrollParent = HTMLElement | Window;

type CleanUpFunction = () => void;
type ScrollDelta = {
	deltaX: number;
	deltaY: number;
};

// type EventType = 'scroll' | 'resize';
enum EventType {
	Scroll = 'scroll',
	Resize = 'resize',
}
export class ContainerEvent implements DispatchableEvent {
	constructor(
		public readonly target: Container,
		public readonly type: `${EventType}`,
		public readonly scrollDelta: ScrollDelta = { deltaX: 0, deltaY: 0 } // I could make an additional EventType only for Scroll Events, but we'll just ignore these for resize evnents...
	) {}
}

export class Container {
	private dimensions = {
		// inner size excluding scrollbars
		clientWidth: 0,
		clientHeight: 0,
		// size of scrollable content
		scrollWidth: 0,
		scrollHeight: 0,
	};
	private scrollPos = {
		top: 0,
		left: 0,
	};
	private dispatcher = new EventDispatcher();
	private cleanups = new Array<CleanUpFunction>();
	/**
	 * TODO: Currently we have no way of detecting, when physical scrollbars appear or disappear, which should technically trigger a resize event.
	 * One potential way of getting around this would be to add an additional resize observer to the documentElement and detect when it crosses 100% of the container's client size (either in or out)
	 * But this seems quite hacky and code intense for this edge case scenario. It would also work for document scrolls, not for Element scrolls.
	 */
	constructor(public readonly scrollParent: ScrollParent) {
		const throttledScroll = throttleRaf(this.updateScrollPos.bind(this));
		const throttledResize = debounce(this.updateDimensions.bind(this), 100);
		this.cleanups.push(
			throttledScroll.cancel,
			throttledResize.cancel,
			this.subscribeScroll(throttledScroll),
			this.subscribeResize(throttledResize)
		);
		this.updateScrollPos();
		this.updateDimensions();
	}

	private updateScrollPos() {
		const prevScrollPos = this.scrollPos;
		this.scrollPos = getScrollPos(this.scrollParent);
		const deltaY = this.scrollPos.top - prevScrollPos.top;
		const deltaX = this.scrollPos.left - prevScrollPos.left;
		this.dispatcher.dispatchEvent(new ContainerEvent(this, EventType.Scroll, { deltaX, deltaY }));
	}

	private updateDimensions() {
		this.dimensions = getScrollContainerDimensions(this.scrollParent);
		this.dispatcher.dispatchEvent(new ContainerEvent(this, EventType.Resize));
	}

	// subscribes to resize events of scrollParent and returns a function to reverse the effect
	private subscribeResize(onResize: () => void) {
		const { scrollParent } = this;
		if (isWindow(scrollParent)) {
			return registerEvent(scrollParent, EventType.Resize, onResize);
		}
		const observer = new ResizeObserver(onResize);
		observer.observe(scrollParent);
		return () => observer.unobserve(scrollParent);
	}

	// subscribes to scroll events of scrollParent and returns a function to reverse the effect
	private subscribeScroll(onScroll: () => void) {
		return registerEvent(this.scrollParent, EventType.Scroll, onScroll);
	}

	// subscribes Container and returns a function to reverse the effect
	public subscribe(type: `${EventType}`, cb: (e: ContainerEvent) => void): () => void {
		return this.dispatcher.addEventListener(type, cb);
	}

	public get size(): Container['dimensions'] {
		return this.dimensions;
	}

	public destroy(): void {
		this.cleanups.forEach(cleanup => cleanup());
		this.cleanups = [];
	}
}
