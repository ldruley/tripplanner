import type { Meta, StoryObj } from '@storybook/angular';
import { RegisterFormComponent } from './register-form.component';
import { within } from '@storybook/testing-library';
import { expect } from '@storybook/jest';

const meta: Meta<RegisterFormComponent> = {
  component: RegisterFormComponent,
  title: 'RegisterFormComponent',
};
export default meta;
type Story = StoryObj<RegisterFormComponent>;

export const Primary: Story = {
  args: {},
};

export const Heading: Story = {
  args: {},
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    expect(canvas.getByText(/register-form works!/gi)).toBeTruthy();
  },
};
