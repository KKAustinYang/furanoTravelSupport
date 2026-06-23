import { useEffect, useRef, useState } from 'react';

// 滚动进入视口时淡入（与原版 .reveal/.in 动画一致）。
// 一旦显示就保持，state 不会因父组件重渲染而丢失。
export default function Reveal({ as: Tag = 'div', className = '', children, ...rest }) {
  const ref = useRef(null);
  const [inView, setInView] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const io = new IntersectionObserver(
      (entries) => {
        entries.forEach((e) => {
          if (e.isIntersecting) {
            setInView(true);
            io.disconnect();
          }
        });
      },
      { threshold: 0.15 }
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);

  return (
    <Tag ref={ref} className={`${className} reveal${inView ? ' in' : ''}`.trim()} {...rest}>
      {children}
    </Tag>
  );
}
