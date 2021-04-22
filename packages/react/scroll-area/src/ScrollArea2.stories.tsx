import * as React from 'react';
import * as ScrollArea from './ScrollArea2';
import { css } from '../../../../stitches.config';

export default { title: 'Components/ScrollArea2' };

export const Basic = () => {
  const [count, setCount] = React.useState(30);
  const [props, setProps] = React.useState({} as any);
  return (
    <>
      <div style={{ margin: '20px auto', width: 'max-content', textAlign: 'center' }}>
        <form
          onChange={(event) => {
            const formData = new FormData(event.currentTarget);
            const entries = (formData as any).entries();
            const cleanup = [...entries].map(([key, value]: any) => [key, value || undefined]);
            const props = Object.fromEntries(cleanup);
            setProps(props);
          }}
        >
          <label>
            type:{' '}
            <select name="type">
              <option></option>
              <option>always</option>
              <option>auto</option>
              <option>scroll</option>
              <option>hover</option>
            </select>
          </label>{' '}
          <label>
            dir:{' '}
            <select name="dir">
              <option></option>
              <option>ltr</option>
              <option>rtl</option>
            </select>
          </label>{' '}
          <label>
            scrollHideDelay: <input type="number" name="scrollHideDelay" />
          </label>
        </form>
        <button onClick={() => setCount((count) => count + 1)}>Add content</button>
      </div>

      <ScrollArea.Root className={scrollAreaClass} {...props}>
        {Array.from({ length: count }).map((_, index) => (
          <p key={index} style={{ width: '500%', marginTop: 0 }}>
            Lorem ipsum dolor sit amet, consectetur adipiscing elit. Fusce sit amet eros iaculis,
            bibendum tellus ac, lobortis odio. Aliquam bibendum elit est, in iaculis est commodo id.
            Donec pulvinar est libero. Proin consectetur pellentesque molestie. Fusce mi ante,
            ullamcorper eu ante finibus, finibus pellentesque turpis. Mauris convallis, leo in
            vulputate varius, sapien lectus suscipit eros, ac semper odio sapien sit amet magna. Sed
            mattis turpis et lacinia ultrices. Nulla a commodo mauris. Orci varius natoque penatibus
            et magnis dis parturient montes, nascetur ridiculus mus. Pellentesque id tempor metus.
            Pellentesque faucibus tortor non nisi maximus dignissim. Etiam leo nisi, molestie a
            porttitor at, euismod a libero. Nullam placerat tristique enim nec pulvinar. Sed
            eleifend dictum nulla a aliquam. Sed tempus ipsum eget urna posuere aliquam. Nulla
            maximus tortor dui, sed laoreet odio aliquet ac. Vestibulum dolor orci, lacinia finibus
            vehicula eget, posuere ac lectus. Quisque non felis at ipsum scelerisque condimentum. In
            pharetra semper arcu, ut hendrerit sem auctor vel. Aliquam non lacinia elit, a facilisis
            ante. Praesent eget eros augue. Praesent nunc orci, ullamcorper non pulvinar eu,
            elementum id nibh. Nam id lorem euismod, sodales augue quis, porttitor magna. Vivamus ut
            nisl velit. Nam ultrices maximus felis, quis ullamcorper quam luctus et.
          </p>
        ))}

        <ScrollArea.Scrollbar
          className={scrollbarHorizontalClass}
          orientation="horizontal"
          scroll={500}
        >
          <ScrollArea.Thumb className={thumbClass} />
        </ScrollArea.Scrollbar>
        <ScrollArea.Scrollbar className={scrollbarVerticalClass} orientation="vertical">
          <ScrollArea.Thumb className={thumbClass} />
        </ScrollArea.Scrollbar>
        <ScrollArea.Corner className={cornerClass} />
      </ScrollArea.Root>
    </>
  );
};

const foo = css({
  width: 400,
  height: 400,
  overflow: 'auto',
});

const bar = css({
  width: '200%',
  height: '200%',
  background: 'red',
});

const SCROLLBAR_SIZE = 8;
const SCROLLBAR_HOVER_SIZE = 12;

const scrollAreaClass = css({
  width: '800px',
  height: '800px',
  margin: '30px auto',
  border: '1px solid black',
});

const scrollbarClass = css({
  display: 'flex',
  opacity: 0.5,
  transition: '160ms ease-out',
  transitionProperty: 'background, opacity, width, height',
  padding: 2,
  '&:hover': {
    background: 'rgba(0,0,0,0.3)',
    opacity: 1,
  },
});

const scrollbarVerticalClass = css(scrollbarClass, {
  flexDirection: 'row',
  width: SCROLLBAR_SIZE,
  '&:hover': {
    width: SCROLLBAR_HOVER_SIZE,
  },
});

const scrollbarHorizontalClass = css(scrollbarClass, {
  flexDirection: 'column',
  height: SCROLLBAR_SIZE,
  '&:hover': {
    height: SCROLLBAR_HOVER_SIZE,
  },
});

const thumbClass = css({
  background: 'black',
  borderRadius: SCROLLBAR_SIZE,
  flex: 1,
});

const cornerClass = css({
  background: 'black',
  opacity: 0.5,
});
