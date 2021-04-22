/// <reference types="resize-observer-browser" />

import * as React from 'react';
import * as ReactDOM from 'react-dom';
import { Primitive } from '@radix-ui/react-primitive';
import { Presence } from '@radix-ui/react-presence';
import { createContext } from '@radix-ui/react-context';
import { useComposedRefs } from '@radix-ui/react-compose-refs';
import { useCallbackRef } from '@radix-ui/react-use-callback-ref';
import { useDirection } from '@radix-ui/react-use-direction';
import { useLayoutEffect } from '@radix-ui/react-use-layout-effect';
import { linearScale } from '@radix-ui/number';
import { useStateMachine } from './useStateMachine';
import debounce from 'lodash.debounce';

import type * as Polymorphic from '@radix-ui/react-polymorphic';
import { composeEventHandlers } from '@radix-ui/primitive';

type PrimitiveElement = React.ElementRef<typeof Primitive>;
type ScrollbarElement = React.ElementRef<typeof ScrollAreaScrollbarImpl>;
type ThumbElement = React.ElementRef<typeof ScrollAreaThumb>;

type Sizes = {
  thumb: number;
  content: number;
  viewport: number;
  scrollbar: {
    size: number;
    paddingStart: number;
    paddingEnd: number;
  };
};

const MAIN_POINTER = 0;

/* -------------------------------------------------------------------------------------------------
 * ScrollArea
 * -----------------------------------------------------------------------------------------------*/

const SCROLL_AREA_NAME = 'ScrollArea';

type ScrollAreaContextValue = {
  type: 'auto' | 'always' | 'scroll' | 'hover';
  dir: 'ltr' | 'rtl';
  scrollHideDelay: number;
  scrollArea: PrimitiveElement | null;
  viewport: HTMLDivElement | null;
  scrollbarX: ScrollbarElement | null;
  onScrollbarXChange(scrollbar: ScrollbarElement | null): void;
  scrollbarY: ScrollbarElement | null;
  onScrollbarYChange(scrollbar: ScrollbarElement | null): void;
  onCornerWidthChange(width: number): void;
  onCornerHeightChange(height: number): void;
  onScrollbarXEnabledChange(rendered: boolean): void;
  onScrollbarYEnabledChange(rendered: boolean): void;
};

const [ScrollAreaProvider, useScrollAreaContext] = createContext<ScrollAreaContextValue>(
  SCROLL_AREA_NAME
);

type ScrollAreaOwnProps = Polymorphic.Merge<
  Polymorphic.OwnProps<typeof Primitive>,
  {
    type?: ScrollAreaContextValue['type'];
    dir?: ScrollAreaContextValue['dir'];
    scrollHideDelay?: number;
  }
>;

type ScrollAreaPrimitive = Polymorphic.ForwardRefComponent<
  Polymorphic.IntrinsicElement<typeof Primitive>,
  ScrollAreaOwnProps
>;

const ScrollArea = React.forwardRef((props, forwardedRef) => {
  const { type = 'hover', dir, scrollHideDelay = 600, children, ...scrollAreaProps } = props;
  const [scrollArea, setScrollArea] = React.useState<PrimitiveElement | null>(null);
  const [viewport, setViewport] = React.useState<HTMLDivElement | null>(null);
  const [scrollbarX, setScrollbarX] = React.useState<ScrollbarElement | null>(null);
  const [scrollbarY, setScrollbarY] = React.useState<ScrollbarElement | null>(null);
  const [cornerWidth, setCornerWidth] = React.useState(0);
  const [cornerHeight, setCornerHeight] = React.useState(0);
  const [isScrollbarXEnabled, setIsScrollbarXEnabled] = React.useState(false);
  const [isScrollbarYEnabled, setIsScrollbarYEnabled] = React.useState(false);
  const composedRefs = useComposedRefs(forwardedRef, (node) => setScrollArea(node));
  const computedDirection = useDirection(scrollArea, dir);

  return (
    <ScrollAreaProvider
      type={type}
      dir={computedDirection}
      scrollHideDelay={scrollHideDelay}
      scrollArea={scrollArea}
      viewport={viewport}
      scrollbarX={scrollbarX}
      onScrollbarXChange={setScrollbarX}
      onScrollbarXEnabledChange={setIsScrollbarXEnabled}
      scrollbarY={scrollbarY}
      onScrollbarYChange={setScrollbarY}
      onScrollbarYEnabledChange={setIsScrollbarYEnabled}
      onCornerWidthChange={setCornerWidth}
      onCornerHeightChange={setCornerHeight}
    >
      <Primitive
        {...scrollAreaProps}
        ref={composedRefs}
        style={{
          position: 'relative',
          ['--radix-scroll-area-corner-width' as any]: cornerWidth + 'px',
          ['--radix-scroll-area-corner-height' as any]: cornerHeight + 'px',
          ...props.style,
        }}
      >
        <style
          dangerouslySetInnerHTML={{
            __html: `[data-radix-scroll-area-viewport]{-ms-overflow-style:none}[data-radix-scroll-area-viewport]::-webkit-scrollbar{display:none}`,
          }}
        />
        <div
          data-radix-scroll-area-viewport=""
          ref={setViewport}
          style={{
            /**
             * We don't support `visible` because the intention is to have at least one scrollbar
             * if this component is used and `visible` will behave like `auto` in that case
             * https://developer.mozilla.org/en-US/docs/Web/CSS/overflowed#description
             *
             * We don't handle `auto` because the intention is for the native implementation
             * to be hidden if using this component. We just want to ensure the node is scrollable
             * so could have used either `scroll` or `auto` here. We picked `scroll` to prevent
             * the browser from having to work out whether to render native scrollbars or not,
             * we tell it to with the intention of hiding them in CSS.
             */
            overflowX: isScrollbarXEnabled ? 'scroll' : 'hidden',
            overflowY: isScrollbarYEnabled ? 'scroll' : 'hidden',
            scrollbarWidth: 'none',
            width: '100%',
            height: '100%',
          }}
        >
          {children}
        </div>
      </Primitive>
    </ScrollAreaProvider>
  );
}) as ScrollAreaPrimitive;

ScrollArea.displayName = SCROLL_AREA_NAME;

/* -------------------------------------------------------------------------------------------------
 * ScrollAreaScrollbar
 * -----------------------------------------------------------------------------------------------*/

const SCROLLBAR_NAME = 'ScrollAreaScrollbar';

type ScrollbarContextValue = {
  onThumbChange(thumb: ThumbElement | null): void;
  onThumbPointerDown(pointerPosition: { x: number; y: number }): void;
  onThumbPointerUp(): void;
  onThumbPositionChange(): void;
};

const [ScrollbarProvider, useScrollbarContext] = createContext<ScrollbarContextValue>(
  SCROLLBAR_NAME
);

type ScrollAreaScrollbarOwnProps =
  | Polymorphic.OwnProps<typeof ScrollAreaScrollbarVisible>
  | Polymorphic.OwnProps<typeof ScrollAreaScrollbarScroll>;

type ScrollAreaScrollbarPrimitive = Polymorphic.ForwardRefComponent<
  | Polymorphic.IntrinsicElement<typeof ScrollAreaScrollbarVisible>
  | Polymorphic.IntrinsicElement<typeof ScrollAreaScrollbarScroll>,
  ScrollAreaScrollbarOwnProps
>;

const ScrollAreaScrollbar = React.forwardRef((props, forwardedRef) => {
  const context = useScrollAreaContext(SCROLLBAR_NAME);
  const { onScrollbarXEnabledChange, onScrollbarYEnabledChange } = context;
  const isHorizontal = props.orientation === 'horizontal';

  React.useEffect(() => {
    isHorizontal ? onScrollbarXEnabledChange(true) : onScrollbarYEnabledChange(true);
    return () => {
      isHorizontal ? onScrollbarXEnabledChange(false) : onScrollbarYEnabledChange(false);
    };
  }, [isHorizontal, onScrollbarXEnabledChange, onScrollbarYEnabledChange]);

  return context.type === 'always' ? (
    <ScrollAreaScrollbarVisible {...props} ref={forwardedRef} />
  ) : context.type === 'auto' ? (
    <ScrollAreaScrollbarAuto {...props} ref={forwardedRef} />
  ) : context.type === 'hover' ? (
    <ScrollAreaScrollbarHover {...props} ref={forwardedRef} />
  ) : context.type === 'scroll' ? (
    <ScrollAreaScrollbarScroll {...props} ref={forwardedRef} />
  ) : null;
}) as ScrollAreaScrollbarPrimitive;

ScrollAreaScrollbar.displayName = SCROLLBAR_NAME;

/* -----------------------------------------------------------------------------------------------*/

type ScrollAreaScrollbarOptionalOwnProps = Polymorphic.Merge<
  Polymorphic.OwnProps<typeof ScrollAreaScrollbarVisible>,
  { forceMount?: true }
>;
type ScrollAreaScrollbarOptionalPrimitive = Polymorphic.ForwardRefComponent<
  Polymorphic.IntrinsicElement<typeof ScrollAreaScrollbarVisible>,
  ScrollAreaScrollbarOptionalOwnProps
>;

const ScrollAreaScrollbarAuto = React.forwardRef((props, forwardedRef) => {
  const context = useScrollAreaContext(SCROLLBAR_NAME);
  const { forceMount, ...scrollbarProps } = props;
  const [visible, setVisible] = React.useState(false);
  const isHorizontal = props.orientation === 'horizontal';

  useResizeObserver(context.viewport, () => {
    if (context.viewport) {
      const isOverflowX = context.viewport.offsetWidth < context.viewport.scrollWidth;
      const isOverflowY = context.viewport.offsetHeight < context.viewport.scrollHeight;
      const isAuto = isHorizontal ? isOverflowX : isOverflowY;
      setVisible(isAuto);
    }
  });

  return (
    <Presence present={forceMount || visible}>
      <ScrollAreaScrollbarVisible {...scrollbarProps} ref={forwardedRef} />
    </Presence>
  );
}) as ScrollAreaScrollbarOptionalPrimitive;

const ScrollAreaScrollbarHover = React.forwardRef((props, forwardedRef) => {
  const { forceMount, ...scrollbarProps } = props;
  const context = useScrollAreaContext(SCROLLBAR_NAME);
  const [visible, setVisible] = React.useState(false);

  React.useEffect(() => {
    const viewport = context.viewport;
    const scrollArea = context.scrollArea;
    if (viewport && scrollArea) {
      // Using mouse over because we need to make sure this also fires
      // when mouse leaves scrollbar and enters scrollarea
      const handlePointerEnter = () => setVisible(true);
      const handlePointerLeave = () => setVisible(false);
      scrollArea.addEventListener('pointerenter', handlePointerEnter);
      scrollArea.addEventListener('pointerleave', handlePointerLeave);
      return () => {
        scrollArea.removeEventListener('mouseover', handlePointerEnter);
        scrollArea.removeEventListener('pointerleave', handlePointerLeave);
      };
    }
  }, [context.scrollArea, context.viewport]);

  return (
    <Presence present={forceMount || visible}>
      <ScrollAreaScrollbarVisible {...scrollbarProps} ref={forwardedRef} />
    </Presence>
  );
}) as ScrollAreaScrollbarOptionalPrimitive;

const ScrollAreaScrollbarScroll = React.forwardRef((props, forwardedRef) => {
  const { forceMount, ...scrollbarProps } = props;
  const context = useScrollAreaContext(SCROLLBAR_NAME);
  const isHorizontal = props.orientation === 'horizontal';
  const [state, send] = useStateMachine('hidden', {
    idle: {
      HIDE: 'hidden',
      SCROLL: 'scrolling',
      SCROLLBAR_POINTER_ENTER: 'interacting',
    },
    hidden: {
      SCROLL: 'scrolling',
      SCROLLBAR_POINTER_ENTER: 'interacting',
    },
    scrolling: {
      SCROLL_END: 'idle',
      SCROLLBAR_POINTER_ENTER: 'interacting',
    },
    interacting: {
      SCROLL: 'interacting',
      SCROLLBAR_POINTER_LEAVE: 'idle',
    },
  });

  React.useEffect(() => {
    if (state === 'idle') {
      const hideTimer = window.setTimeout(() => send('HIDE'), context.scrollHideDelay);
      return () => clearTimeout(hideTimer);
    }
  }, [state, context.scrollHideDelay, send]);

  const debounceScrollEnd = React.useRef(debounce(() => send('SCROLL_END'), 100)).current;
  React.useEffect(() => {
    const viewport = context.viewport;
    if (viewport) {
      const scrollDirection = isHorizontal ? 'scrollLeft' : 'scrollTop';
      let prevScrollPos = viewport[scrollDirection];
      const handleScroll = () => {
        const scrollPos = viewport[scrollDirection];
        if (prevScrollPos !== scrollPos) {
          send('SCROLL');
          debounceScrollEnd();
        }
        prevScrollPos = scrollPos;
      };
      viewport.addEventListener('scroll', handleScroll);
      return () => viewport.removeEventListener('scroll', handleScroll);
    }
  }, [context.viewport, isHorizontal, send, debounceScrollEnd]);

  return (
    <Presence present={forceMount || state !== 'hidden'}>
      <ScrollAreaScrollbarVisible
        {...scrollbarProps}
        ref={forwardedRef}
        onPointerEnter={composeEventHandlers(props.onPointerEnter, () => {
          send('SCROLLBAR_POINTER_ENTER');
        })}
        onPointerLeave={composeEventHandlers(props.onPointerLeave, () => {
          send('SCROLLBAR_POINTER_LEAVE');
        })}
      />
    </Presence>
  );
}) as ScrollAreaScrollbarOptionalPrimitive;

/* -----------------------------------------------------------------------------------------------*/

type ScrollAreaScrollbarVisibleOwnProps = Polymorphic.Merge<
  Omit<
    | Polymorphic.OwnProps<typeof ScrollAreaScrollbarX>
    | Polymorphic.OwnProps<typeof ScrollAreaScrollbarY>,
    keyof ScrollAreaScrollbarAxisProps
  >,
  { orientation?: 'horizontal' | 'vertical' }
>;

type ScrollAreaScrollbarVisiblePrimitive = Polymorphic.ForwardRefComponent<
  | Polymorphic.IntrinsicElement<typeof ScrollAreaScrollbarX>
  | Polymorphic.IntrinsicElement<typeof ScrollAreaScrollbarY>,
  ScrollAreaScrollbarVisibleOwnProps
>;

const ScrollAreaScrollbarVisible = React.forwardRef((props, forwardedRef) => {
  const { orientation = 'vertical', ...scrollbarProps } = props;
  const context = useScrollAreaContext(SCROLLBAR_NAME);
  const pointerOffsetRef = React.useRef(0);
  const [thumbRatio, setThumbRatio] = React.useState(0);
  const [thumb, setThumb] = React.useState<ThumbElement | null>(null);
  const thumbSizePct = thumbRatio * 100;

  function getScrollPositionFromPointer(pointerPos: number, sizes: Omit<Sizes, 'thumb'>) {
    const thumbSizePx = getThumbSizePx(thumbRatio, sizes.scrollbar);
    const pointerOffset = pointerOffsetRef.current || thumbSizePx / 2;
    return interpolateScrollPositionFromPointer(pointerPos, pointerOffset, {
      ...sizes,
      thumb: thumbSizePx,
    });
  }

  function getThumbOffsetFromScroll(scrollPos: number, sizes: Omit<Sizes, 'thumb'>) {
    const thumbSizePx = getThumbSizePx(thumbRatio, sizes.scrollbar);
    return interpolateThumbOffsetFromScroll(scrollPos, {
      ...sizes,
      thumb: thumbSizePx,
    });
  }

  function preventPageScrollOnWheel(event: WheelEvent, scrollPos: number, maxScrollPos: number) {
    const isScrollingScrollbar = scrollPos > 0 && scrollPos < maxScrollPos;
    if (isScrollingScrollbar) event.preventDefault();
  }

  if (orientation === 'horizontal') {
    return (
      <ScrollAreaScrollbarX
        {...scrollbarProps}
        ref={forwardedRef}
        thumbSizePct={thumbSizePct}
        onThumbChange={setThumb}
        onThumbRatioChange={setThumbRatio}
        onThumbPointerDown={(pointerPos) => (pointerOffsetRef.current = pointerPos.x)}
        onThumbPointerUp={() => (pointerOffsetRef.current = 0)}
        onThumbPositionChange={(scrollPos, sizes) => {
          const x = getThumbOffsetFromScroll(scrollPos, sizes);
          if (thumb) thumb.style.transform = `translate3d(${x}px, 0, 0)`;
        }}
        onDragScroll={(pointerPosition, sizes) => {
          const scrollPos = getScrollPositionFromPointer(pointerPosition, sizes);
          if (context.viewport) context.viewport.scrollLeft = scrollPos;
        }}
        onWheelScroll={(event, scrollPos, maxScrollPos) => {
          preventPageScrollOnWheel(event, scrollPos, maxScrollPos);
          if (context.viewport) context.viewport.scrollLeft = scrollPos;
        }}
      />
    );
  }

  if (orientation === 'vertical') {
    return (
      <ScrollAreaScrollbarY
        {...scrollbarProps}
        ref={forwardedRef}
        thumbSizePct={thumbSizePct}
        onThumbChange={setThumb}
        onThumbRatioChange={setThumbRatio}
        onThumbPointerDown={(pointerPos) => (pointerOffsetRef.current = pointerPos.y)}
        onThumbPointerUp={() => (pointerOffsetRef.current = 0)}
        onThumbPositionChange={(scrollPos, sizes) => {
          const y = getThumbOffsetFromScroll(scrollPos, sizes);
          if (thumb) thumb.style.transform = `translate3d(0, ${y}px, 0)`;
        }}
        onDragScroll={(pointerPos, sizes) => {
          const scrollPos = getScrollPositionFromPointer(pointerPos, sizes);
          if (context.viewport) context.viewport.scrollTop = scrollPos;
        }}
        onWheelScroll={(event, scrollPos, maxScrollPos) => {
          preventPageScrollOnWheel(event, scrollPos, maxScrollPos);
          if (context.viewport) context.viewport.scrollTop = scrollPos;
        }}
      />
    );
  }

  return null;
}) as ScrollAreaScrollbarVisiblePrimitive;

/* -----------------------------------------------------------------------------------------------*/

type ScrollAreaScrollbarAxisProps = {
  thumbSizePct: number;
  onThumbChange: ScrollbarContextValue['onThumbChange'];
  onThumbPointerDown: ScrollbarContextValue['onThumbPointerDown'];
  onThumbPointerUp: ScrollbarContextValue['onThumbPointerUp'];
  onThumbRatioChange(thumbRatio: number): void;
  onThumbPositionChange(scrollPos: number, sizes: Omit<Sizes, 'thumb'>): void;
  onDragScroll(pointerPosition: number, sizes: Omit<Sizes, 'thumb'>): void;
  onWheelScroll(event: WheelEvent, scrollPos: number, maxScrollPos: number): void;
};

type ScrollAreaScrollbarXOwnProps = Polymorphic.Merge<
  Polymorphic.OwnProps<typeof ScrollAreaScrollbarImpl>,
  ScrollAreaScrollbarAxisProps
>;
type ScrollAreaScrollbarXPrimitive = Polymorphic.ForwardRefComponent<
  Polymorphic.IntrinsicElement<typeof ScrollAreaScrollbarImpl>,
  ScrollAreaScrollbarXOwnProps
>;

const ScrollAreaScrollbarX = React.forwardRef((props, forwardedRef) => {
  const {
    thumbSizePct,
    onThumbChange,
    onThumbPointerDown,
    onThumbPointerUp,
    onThumbRatioChange,
    onThumbPositionChange,
    ...scrollbarProps
  } = props;
  const context = useScrollAreaContext(SCROLLBAR_NAME);
  const [computedStyle, setComputedStyle] = React.useState<CSSStyleDeclaration>();
  const handleThumbRatioChange = useCallbackRef(onThumbRatioChange);
  const composeRefs = useComposedRefs(forwardedRef, context.onScrollbarXChange);
  const scrollbar = context.scrollbarX;

  const getScrollbarSizes = () => ({
    size: scrollbar?.clientWidth || 0,
    paddingStart: toInt(computedStyle?.paddingLeft),
    paddingEnd: toInt(computedStyle?.paddingRight),
  });

  // when re-rendering we need to know if the
  // content  size changed so we can update ratios
  const contentWidth = context.viewport?.scrollWidth || 0;
  useLayoutEffect(() => {
    if (scrollbar) {
      const computedStyle = getComputedStyle(scrollbar);
      const scrollbarWidth = toInt(computedStyle?.width);
      handleThumbRatioChange(scrollbarWidth / contentWidth);
      setComputedStyle(computedStyle);
    }
  }, [scrollbar, contentWidth, handleThumbRatioChange]);

  return (
    <ScrollbarProvider
      onThumbChange={useCallbackRef(onThumbChange)}
      onThumbPointerUp={useCallbackRef(onThumbPointerUp)}
      onThumbPointerDown={useCallbackRef(onThumbPointerDown)}
      onThumbPositionChange={useCallbackRef(() => {
        if (context.viewport) {
          onThumbPositionChange(context.viewport.scrollLeft, {
            content: context.viewport.scrollWidth,
            viewport: context.viewport.offsetWidth,
            scrollbar: getScrollbarSizes(),
          });
        }
      })}
    >
      <ScrollAreaScrollbarImpl
        {...scrollbarProps}
        ref={composeRefs}
        style={{
          bottom: 0,
          left: context.dir === 'rtl' ? 'var(--radix-scroll-area-corner-width)' : 0,
          right: context.dir === 'ltr' ? 'var(--radix-scroll-area-corner-width)' : 0,
          ['--radix-scroll-area-thumb-width' as any]: thumbSizePct + '%',
          ...scrollbarProps.style,
        }}
        onDragScroll={(pointerPosition) => {
          if (context.viewport) {
            props.onDragScroll(pointerPosition.x, {
              content: context.viewport.scrollWidth,
              viewport: context.viewport.offsetWidth,
              scrollbar: getScrollbarSizes(),
            });
          }
        }}
        onWheelScroll={(event) => {
          if (context.viewport) {
            const scrollPos = context.viewport.scrollLeft + event.deltaX;
            const maxScrollPos = context.viewport.scrollWidth - context.viewport.offsetWidth;
            props.onWheelScroll(event, scrollPos, maxScrollPos);
          }
        }}
      />
    </ScrollbarProvider>
  );
}) as ScrollAreaScrollbarXPrimitive;

type ScrollAreaScrollbarYOwnProps = Polymorphic.Merge<
  Polymorphic.OwnProps<typeof ScrollAreaScrollbarImpl>,
  ScrollAreaScrollbarAxisProps
>;
type ScrollAreaScrollbarYPrimitive = Polymorphic.ForwardRefComponent<
  Polymorphic.IntrinsicElement<typeof ScrollAreaScrollbarImpl>,
  ScrollAreaScrollbarYOwnProps
>;

const ScrollAreaScrollbarY = React.forwardRef((props, forwardedRef) => {
  const {
    thumbSizePct,
    onThumbChange,
    onThumbPointerDown,
    onThumbPointerUp,
    onThumbRatioChange,
    onThumbPositionChange,
    ...scrollbarProps
  } = props;
  const context = useScrollAreaContext(SCROLLBAR_NAME);
  const [computedStyle, setComputedStyle] = React.useState<CSSStyleDeclaration>();
  const handleThumbRatioChange = useCallbackRef(onThumbRatioChange);
  const composeRefs = useComposedRefs(forwardedRef, context.onScrollbarYChange);
  const scrollbar = context.scrollbarY;

  const getScrollbarSizes = () => ({
    size: scrollbar?.clientHeight || 0,
    paddingStart: toInt(computedStyle?.paddingTop),
    paddingEnd: toInt(computedStyle?.paddingBottom),
  });

  // when re-rendering we need to know if the
  // content  size changed so we can update ratios
  const contentHeight = context.viewport?.scrollHeight || 0;
  useLayoutEffect(() => {
    if (scrollbar) {
      const computedStyle = getComputedStyle(scrollbar);
      const scrollbarHeight = toInt(computedStyle?.height);
      handleThumbRatioChange(scrollbarHeight / contentHeight);
      setComputedStyle(computedStyle);
    }
  }, [scrollbar, contentHeight, handleThumbRatioChange]);

  return (
    <ScrollbarProvider
      onThumbChange={useCallbackRef(onThumbChange)}
      onThumbPointerUp={useCallbackRef(onThumbPointerUp)}
      onThumbPointerDown={useCallbackRef(onThumbPointerDown)}
      onThumbPositionChange={useCallbackRef(() => {
        if (context.viewport) {
          onThumbPositionChange(context.viewport.scrollTop, {
            content: context.viewport.scrollHeight,
            viewport: context.viewport.offsetHeight,
            scrollbar: getScrollbarSizes(),
          });
        }
      })}
    >
      <ScrollAreaScrollbarImpl
        {...scrollbarProps}
        ref={composeRefs}
        style={{
          top: 0,
          right: context.dir === 'ltr' ? 0 : undefined,
          left: context.dir === 'rtl' ? 0 : undefined,
          bottom: 'var(--radix-scroll-area-corner-height)',
          ['--radix-scroll-area-thumb-height' as any]: thumbSizePct + '%',
          ...scrollbarProps.style,
        }}
        onDragScroll={(pointerPosition) => {
          if (context.viewport) {
            props.onDragScroll(pointerPosition.y, {
              content: context.viewport.scrollHeight,
              viewport: context.viewport.offsetHeight,
              scrollbar: getScrollbarSizes(),
            });
          }
        }}
        onWheelScroll={(event) => {
          if (context.viewport) {
            const scrollPos = context.viewport.scrollTop + event.deltaY;
            const maxScrollPos = context.viewport.scrollHeight - context.viewport.offsetHeight;
            props.onWheelScroll(event, scrollPos, maxScrollPos);
          }
        }}
      />
    </ScrollbarProvider>
  );
}) as ScrollAreaScrollbarYPrimitive;

/* -----------------------------------------------------------------------------------------------*/

type ScrollAreaScrollbarImplOwnProps = Polymorphic.Merge<
  Polymorphic.OwnProps<typeof Primitive>,
  {
    onWheelScroll(event: WheelEvent): void;
    onDragScroll(pointerPosition: { x: number; y: number }): void;
  }
>;

type ScrollAreaScrollbarImplPrimitive = Polymorphic.ForwardRefComponent<
  Polymorphic.IntrinsicElement<typeof Primitive>,
  ScrollAreaScrollbarImplOwnProps
>;

const ScrollAreaScrollbarImpl = React.forwardRef((props, forwardedRef) => {
  const { onDragScroll, onWheelScroll, ...scrollbarProps } = props;
  const context = useScrollAreaContext(SCROLLBAR_NAME);
  const [scrollbar, setScrollbar] = React.useState<ScrollbarElement | null>(null);
  const composeRefs = useComposedRefs(forwardedRef, (node) => setScrollbar(node));
  const rectRef = React.useRef<ClientRect | null>(null);
  const viewport = context.viewport;
  const handleWheelScroll = useCallbackRef(onWheelScroll);

  /**
   * We bind wheel event imperatively so we can switch off passive
   * mode for document wheel event to allow it to be prevented
   */
  React.useEffect(() => {
    const opts: AddEventListenerOptions = { passive: false };
    const handleWheel = (event: WheelEvent) => {
      const element = event.target as HTMLElement;
      const isScrollbarWheel = scrollbar?.contains(element);
      if (isScrollbarWheel) handleWheelScroll(event);
    };
    document.addEventListener('wheel', handleWheel, opts);
    return () => document.removeEventListener('wheel', handleWheel, opts);
  }, [viewport, scrollbar, handleWheelScroll]);

  function handleDragScroll(event: React.PointerEvent<HTMLElement>) {
    if (rectRef.current) {
      const x = event.clientX - rectRef.current.left;
      const y = event.clientY - rectRef.current.top;
      onDragScroll({ x, y });
    }
  }

  return context.scrollArea
    ? ReactDOM.createPortal(
        <Primitive
          {...scrollbarProps}
          ref={composeRefs}
          style={{
            position: 'absolute',
            userSelect: 'none',
            touchAction: 'none',
            ...scrollbarProps.style,
          }}
          onPointerDown={composeEventHandlers(props.onPointerDown, (event) => {
            if (event.button === MAIN_POINTER) {
              const element = event.target as HTMLElement;
              element.setPointerCapture(event.pointerId);
              rectRef.current = scrollbar!.getBoundingClientRect();
              handleDragScroll(event);
            }
          })}
          onPointerMove={composeEventHandlers(props.onPointerMove, handleDragScroll)}
          onPointerUp={composeEventHandlers(props.onPointerUp, (event) => {
            const element = event.target as HTMLElement;
            element.releasePointerCapture(event.pointerId);
            rectRef.current = null;
          })}
        />,
        context.scrollArea
      )
    : null;
}) as ScrollAreaScrollbarImplPrimitive;

/* -------------------------------------------------------------------------------------------------
 * ScrollAreaThumb
 * -----------------------------------------------------------------------------------------------*/

const THUMB_NAME = 'ScrollbarThumb';

type ScrollAreaThumbOwnProps = Polymorphic.OwnProps<typeof Primitive>;
type ScrollAreaThumbPrimitive = Polymorphic.ForwardRefComponent<
  Polymorphic.IntrinsicElement<typeof Primitive>,
  ScrollAreaThumbOwnProps
>;

const ScrollAreaThumb = React.forwardRef((props, forwardedRef) => {
  const { style, ...thumbProps } = props;
  const scrollAreaContext = useScrollAreaContext(THUMB_NAME);
  const scrollbarContext = useScrollbarContext(THUMB_NAME);
  const { onThumbPositionChange } = scrollbarContext;
  const [thumb, setThumb] = React.useState<React.ElementRef<typeof Primitive> | null>(null);
  const composedRef = useComposedRefs(forwardedRef, scrollbarContext.onThumbChange, (node) => {
    setThumb(node);
  });

  useResizeObserver(thumb, onThumbPositionChange);

  React.useEffect(() => {
    const viewport = scrollAreaContext.viewport;
    if (viewport) {
      viewport.addEventListener('scroll', onThumbPositionChange);
      return () => viewport.removeEventListener('scroll', onThumbPositionChange);
    }
  }, [scrollAreaContext.viewport, onThumbPositionChange]);

  return (
    <Primitive
      {...thumbProps}
      ref={composedRef}
      style={{
        width: 'var(--radix-scroll-area-thumb-width)',
        height: 'var(--radix-scroll-area-thumb-height)',
        ...style,
      }}
      onPointerDownCapture={composeEventHandlers(props.onPointerDownCapture, (event) => {
        const thumb = event.target as HTMLElement;
        const thumbRect = thumb.getBoundingClientRect();
        const x = event.clientX - thumbRect.left;
        const y = event.clientY - thumbRect.top;
        scrollbarContext.onThumbPointerDown({ x, y });
      })}
      onPointerUp={composeEventHandlers(props.onPointerUp, scrollbarContext.onThumbPointerUp)}
    />
  );
}) as ScrollAreaThumbPrimitive;

ScrollAreaThumb.displayName = THUMB_NAME;

/* -------------------------------------------------------------------------------------------------
 * ScrollAreaCorner
 * -----------------------------------------------------------------------------------------------*/

const CORNER_NAME = 'ScrollAreaCorner';

type ScrollAreaCornerOwnProps = Polymorphic.OwnProps<typeof Primitive>;
type ScrollAreaCornerPrimitive = Polymorphic.ForwardRefComponent<
  Polymorphic.IntrinsicElement<typeof Primitive>,
  ScrollAreaCornerOwnProps
>;

const ScrollAreaCorner = React.forwardRef((props, forwardedRef) => {
  const context = useScrollAreaContext(CORNER_NAME);
  const hasCorner = context.scrollbarX && context.scrollbarY;

  useResizeObserver(context.scrollbarX, () => {
    context.onCornerHeightChange(context.scrollbarX?.offsetHeight || 0);
  });

  useResizeObserver(context.scrollbarY, () => {
    context.onCornerWidthChange(context.scrollbarY?.offsetWidth || 0);
  });

  return hasCorner && context.scrollArea
    ? ReactDOM.createPortal(
        <Primitive
          {...props}
          ref={forwardedRef}
          style={{
            width: 'var(--radix-scroll-area-corner-width)',
            height: 'var(--radix-scroll-area-corner-height)',
            position: 'absolute',
            right: context.dir === 'ltr' ? 0 : undefined,
            left: context.dir === 'rtl' ? 0 : undefined,
            bottom: 0,
            ...props.style,
          }}
        />,
        context.scrollArea
      )
    : null;
}) as ScrollAreaCornerPrimitive;

ScrollAreaCorner.displayName = CORNER_NAME;

/* -----------------------------------------------------------------------------------------------*/

function getThumbSizePx(ratio: number, scrollbar: Sizes['scrollbar']) {
  const scrollbarPadding = scrollbar.paddingStart + scrollbar.paddingEnd;
  return (scrollbar.size - scrollbarPadding) * ratio;
}

function interpolateScrollPositionFromPointer(
  pointerPos: number,
  pointerOffset: number,
  sizes: Sizes
) {
  const thumbOffsetFromEnd = sizes.thumb - pointerOffset;
  const minPointerPos = sizes.scrollbar.paddingStart + pointerOffset;
  const maxPointerPos = sizes.scrollbar.size - sizes.scrollbar.paddingEnd - thumbOffsetFromEnd;
  const maxScrollPos = sizes.content - sizes.viewport;
  const interpolate = linearScale([minPointerPos, maxPointerPos], [0, maxScrollPos]);
  return interpolate(pointerPos);
}

function interpolateThumbOffsetFromScroll(scrollPos: number, sizes: Sizes) {
  const scrollbarPadding = sizes.scrollbar.paddingStart + sizes.scrollbar.paddingEnd;
  const scrollbar = sizes.scrollbar.size - scrollbarPadding;
  const maxScrollPos = sizes.content - sizes.viewport;
  const maxThumbPos = scrollbar - sizes.thumb;
  const interpolate = linearScale([0, maxScrollPos], [0, maxThumbPos]);
  return interpolate(scrollPos);
}

function toInt(value?: string) {
  return value ? parseInt(value, 10) : 0;
}

function useResizeObserver(element: HTMLElement | null, onResize: () => void) {
  const handleResize = useCallbackRef(onResize);
  React.useEffect(() => {
    if (element) {
      const resizeObserver = new ResizeObserver(handleResize);
      resizeObserver.observe(element);
      return () => {
        // resized to nothing because it has been unmounted
        handleResize();
        resizeObserver.unobserve(element);
      };
    }
  }, [element, handleResize]);
}

/* -----------------------------------------------------------------------------------------------*/

const Root = ScrollArea;
const Scrollbar = ScrollAreaScrollbar;
const Thumb = ScrollAreaThumb;
const Corner = ScrollAreaCorner;

export {
  ScrollArea,
  ScrollAreaScrollbar,
  ScrollAreaThumb,
  ScrollAreaCorner,
  //
  Root,
  Scrollbar,
  Thumb,
  Corner,
};
