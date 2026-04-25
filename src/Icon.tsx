import React from 'react';

interface IconProps {
  name: string;
  size?: number;
  className?: string;
  style?: React.CSSProperties;
  [key: string]: any;
}

export const Icon: React.FC<IconProps> = ({ 
  name, 
  size = 16, 
  className = "", 
  style = {}, 
  ...rest 
}) => (
  <span
    className={`material-symbols-outlined ${className}`.trim()}
    style={{
      fontSize: size,
      lineHeight: 1,
      display: "inline-flex",
      alignItems: "center",
      justifyContent: "center",
      verticalAlign: "middle",
      userSelect: "none",
      ...style
    }}
    {...rest}
  >
    {name}
  </span>
);

// Иконки инструментов
export const Hand = (props: Omit<IconProps, 'name'>) => <Icon name="pan_tool_alt" {...props} />;
export const MousePointer2 = (props: Omit<IconProps, 'name'>) => <Icon name="arrow_selector_tool" {...props} />;
export const Square = (props: Omit<IconProps, 'name'>) => <Icon name="crop_square" {...props} />;
export const Circle = (props: Omit<IconProps, 'name'>) => <Icon name="circle" {...props} />;
export const Triangle = (props: Omit<IconProps, 'name'>) => <Icon name="change_history" {...props} />;
export const Minus = (props: Omit<IconProps, 'name'>) => <Icon name="remove" {...props} />;
export const Trash2 = (props: Omit<IconProps, 'name'>) => <Icon name="delete" {...props} />;
export const FileImage = (props: Omit<IconProps, 'name'>) => <Icon name="imagesmode" {...props} />;
export const Settings2 = (props: Omit<IconProps, 'name'>) => <Icon name="tune" {...props} />;
export const X = (props: Omit<IconProps, 'name'>) => <Icon name="close" {...props} />;
export const Lock = (props: Omit<IconProps, 'name'>) => <Icon name="lock" {...props} />;
export const Unlock = (props: Omit<IconProps, 'name'>) => <Icon name="lock_open" {...props} />;
export const RotateCw = (props: Omit<IconProps, 'name'>) => <Icon name="refresh" {...props} />;
export const Droplets = (props: Omit<IconProps, 'name'>) => <Icon name="water_drop" {...props} />;
export const Type = (props: Omit<IconProps, 'name'>) => <Icon name="opacity" {...props} />;
export const Layers = (props: Omit<IconProps, 'name'>) => <Icon name="layers" {...props} />;
export const Eye = (props: Omit<IconProps, 'name'>) => <Icon name="visibility" {...props} />;
export const EyeOff = (props: Omit<IconProps, 'name'>) => <Icon name="visibility_off" {...props} />;
export const PenTool = (props: Omit<IconProps, 'name'>) => <Icon name="draw" {...props} />;
export const Pentagon = (props: Omit<IconProps, 'name'>) => <Icon name="pentagon" {...props} />;
export const Check = (props: Omit<IconProps, 'name'>) => <Icon name="check" {...props} />;
export const Hash = (props: Omit<IconProps, 'name'>) => <Icon name="tag" {...props} />;
export const Sun = (props: Omit<IconProps, 'name'>) => <Icon name="light_mode" {...props} />;
export const Palette = (props: Omit<IconProps, 'name'>) => <Icon name="palette" {...props} />;
export const Maximize = (props: Omit<IconProps, 'name'>) => <Icon name="fullscreen" {...props} />;
export const Minimize = (props: Omit<IconProps, 'name'>) => <Icon name="fullscreen_exit" {...props} />;
export const Contrast = (props: Omit<IconProps, 'name'>) => <Icon name="contrast" {...props} />;
