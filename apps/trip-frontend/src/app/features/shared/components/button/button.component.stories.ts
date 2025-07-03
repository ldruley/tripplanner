import type { Meta, StoryObj } from '@storybook/angular';
import { ButtonComponent } from './button.component';
import { fn } from '@storybook/test';
import { within } from '@storybook/testing-library';
import { expect } from '@storybook/jest';

const meta: Meta<ButtonComponent> = {
  title: 'Components/Button',
  component: ButtonComponent,
  parameters: {
    layout: 'centered',
  },
  tags: ['autodocs'],
  argTypes: {
    variant: {
      control: { type: 'select' },
      options: ['primary', 'secondary', 'outline', 'ghost', 'danger'],
    },
    size: {
      control: { type: 'select' },
      options: ['sm', 'md', 'lg'],
    },
    type: {
      control: { type: 'select' },
      options: ['button', 'submit', 'reset'],
    },
    disabled: {
      control: { type: 'boolean' },
    },
    loading: {
      control: { type: 'boolean' },
    },
    fullWidth: {
      control: { type: 'boolean' },
    },
    buttonClick: { action: 'clicked' },
  },
  args: {
    buttonClick: fn(),
  },
};

export default meta;
type Story = StoryObj<ButtonComponent>;

// Default story
export const Default: Story = {
  args: {
    variant: 'primary',
    size: 'md',
    disabled: false,
    loading: false,
    fullWidth: false,
  },
  render: args => ({
    props: args,
    template: `<tp-button
      [variant]="variant"
      [size]="size"
      [type]="type"
      [disabled]="disabled"
      [loading]="loading"
      [fullWidth]="fullWidth"
      (buttonClick)="buttonClick($event)">
      Button Text
    </tp-button>`,
  }),
};

// Variant stories
export const Primary: Story = {
  args: {
    variant: 'primary',
  },
  render: args => ({
    props: args,
    template: `<tp-button [variant]="variant" (buttonClick)="buttonClick($event)">Primary Button</tp-button>`,
  }),
};

export const Secondary: Story = {
  args: {
    variant: 'secondary',
  },
  render: args => ({
    props: args,
    template: `<tp-button [variant]="variant" (buttonClick)="buttonClick($event)">Secondary Button</tp-button>`,
  }),
};

export const Outline: Story = {
  args: {
    variant: 'outline',
  },
  render: args => ({
    props: args,
    template: `<tp-button [variant]="variant" (buttonClick)="buttonClick($event)">Outline Button</tp-button>`,
  }),
};

export const Ghost: Story = {
  args: {
    variant: 'ghost',
  },
  render: args => ({
    props: args,
    template: `<tp-button [variant]="variant" (buttonClick)="buttonClick($event)">Ghost Button</tp-button>`,
  }),
};

export const Danger: Story = {
  args: {
    variant: 'danger',
  },
  render: args => ({
    props: args,
    template: `<tp-button [variant]="variant" (buttonClick)="buttonClick($event)">Danger Button</tp-button>`,
  }),
};

// Size stories
export const Small: Story = {
  args: {
    size: 'sm',
  },
  render: args => ({
    props: args,
    template: `<tp-button [size]="size" (buttonClick)="buttonClick($event)">Small Button</tp-button>`,
  }),
};

export const Medium: Story = {
  args: {
    size: 'md',
  },
  render: args => ({
    props: args,
    template: `<tp-button [size]="size" (buttonClick)="buttonClick($event)">Medium Button</tp-button>`,
  }),
};

export const Large: Story = {
  args: {
    size: 'lg',
  },
  render: args => ({
    props: args,
    template: `<tp-button [size]="size" (buttonClick)="buttonClick($event)">Large Button</tp-button>`,
  }),
};

// State stories
export const Loading: Story = {
  args: {
    loading: true,
  },
  render: args => ({
    props: args,
    template: `<tp-button [loading]="loading" (buttonClick)="buttonClick($event)">Loading Button</tp-button>`,
  }),
};

export const Disabled: Story = {
  args: {
    disabled: true,
  },
  render: args => ({
    props: args,
    template: `<tp-button [disabled]="disabled" (buttonClick)="buttonClick($event)">Disabled Button</tp-button>`,
  }),
};

export const FullWidth: Story = {
  args: {
    fullWidth: true,
  },
  render: args => ({
    props: args,
    template: `<div style="width: 300px;"><tp-button [fullWidth]="fullWidth" (buttonClick)="buttonClick($event)">Full Width Button</tp-button></div>`,
  }),
};

// Combination stories
export const AllVariants: Story = {
  render: () => ({
    template: `
      <div style="display: flex; flex-direction: column; gap: 16px; align-items: flex-start;">
        <tp-button variant="primary">Primary Button</tp-button>
        <tp-button variant="secondary">Secondary Button</tp-button>
        <tp-button variant="outline">Outline Button</tp-button>
        <tp-button variant="ghost">Ghost Button</tp-button>
        <tp-button variant="danger">Danger Button</tp-button>
      </div>
    `,
  }),
};

export const AllSizes: Story = {
  render: () => ({
    template: `
      <div style="display: flex; gap: 16px; align-items: center;">
        <tp-button size="sm">Small</tp-button>
        <tp-button size="md">Medium</tp-button>
        <tp-button size="lg">Large</tp-button>
      </div>
    `,
  }),
};

export const WithIcons: Story = {
  render: () => ({
    template: `
      <div style="display: flex; gap: 16px; align-items: center;">
        <tp-button variant="primary">
          <svg class="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4"></path>
          </svg>
          Add Item
        </tp-button>
        <tp-button variant="outline">
          <svg class="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z"></path>
          </svg>
          Edit
        </tp-button>
        <tp-button variant="danger">
          <svg class="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"></path>
          </svg>
          Delete
        </tp-button>
      </div>
    `,
  }),
};
