'use client';

import { Input } from "../components-core";
import { forwardRef, useRef, useState } from 'react';
import { useDesign } from "..";
import styled from "styled-components";
import { ColorPalette } from "../providers/design-provider";
import { Eye, EyeOff } from 'lucide-react';

const getIconStyle = (colors: ColorPalette) => `
  height: 1rem;
  width: 1rem;
  color: #808080
`;
const StyledEyeOff = styled(EyeOff)<{ colors: ColorPalette }>`${props => getIconStyle(props.colors)}`;
const StyledEye = styled(Eye)<{ colors: ColorPalette }>`${props => getIconStyle(props.colors)}`;

const PasswordField = forwardRef<
  HTMLInputElement, 
  React.InputHTMLAttributes<HTMLInputElement>
>(({ id, name, ...props }, ref) => {
  const [isOpen, setIsOpen] = useState(false);
  const { colors } = useDesign();
  const inputRef = useRef<HTMLInputElement | null>(null);

  const mergeRef = (node: HTMLInputElement) => {
    if (ref) {
      if (typeof ref === 'function') {
        ref(node);
      } else {
        ref.current = node;
      }
    }
    inputRef.current = node;
  };

  const onClickReveal = () => {
    setIsOpen(!isOpen);
    const currentInput = inputRef.current;
    if (currentInput) {
      currentInput.focus({ preventScroll: true });
    }
  };

  return (
    <div style={{ position: 'relative', display: 'flex' }}>
      <Input
        id={id}
        ref={mergeRef}
        name={name}
        type={isOpen ? 'text' : 'password'}
        autoComplete="current-password"
        required
        style={{ flex: 1 }}
        {...props}
      />
      <button
        tabIndex={-1}
        type="button"
        style={{ 
          position: 'absolute', 
          backgroundColor: 'transparent',
          border: 'none',
          top: 0, 
          right: 0, 
          bottom: 0, 
          display: 'flex', 
          alignItems: 'center', 
          paddingRight: '12px' 
        }}
        onClick={onClickReveal}
        aria-label={isOpen ? 'Mask password' : 'Reveal password'}
      >
        {isOpen ? <StyledEyeOff colors={colors} /> : <StyledEye colors={colors} />}
      </button>
    </div>
  );
});

PasswordField.displayName = 'PasswordField';

export default PasswordField;
