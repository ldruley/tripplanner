import {
  Directive,
  Input,
  ElementRef,
  inject,
  OnInit,
  OnDestroy,
  ViewContainerRef,
  ComponentRef,
  HostListener,
  HostBinding,
} from '@angular/core';
import {
  Overlay,
  OverlayRef,
  OverlayPositionBuilder,
  ConnectedPosition,
} from '@angular/cdk/overlay';
import { ComponentPortal } from '@angular/cdk/portal';
import { Location } from '@trip-planner/types';
import { SettingsService } from '../../settings/services/settings.service';
import { getTimezoneAbbreviation } from '@trip-planner/date-utils';
import { DateTime } from 'luxon';
import { Component } from '@angular/core';

@Component({
  selector: 'app-timezone-tooltip-content',
  standalone: true,
  template: `
    <div class="px-2 py-1 text-xs text-white bg-gray-800 rounded shadow-lg whitespace-nowrap">
      {{ tooltipText }}
    </div>
  `,
})
export class TimezoneTooltipContentComponent {
  tooltipText = '';
}

@Directive({
  selector: '[appTimezoneTooltip]',
  standalone: true,
})
export class TimezoneTooltipDirective implements OnInit, OnDestroy {
  @Input('appTimezoneTooltip') date: Date | null | undefined = null;
  @Input() location: Location | null | undefined = null;

  private readonly elementRef = inject(ElementRef);
  private readonly settingsService = inject(SettingsService);
  private readonly overlay = inject(Overlay);
  private readonly positionBuilder = inject(OverlayPositionBuilder);
  private readonly viewContainerRef = inject(ViewContainerRef);

  private overlayRef: OverlayRef | null = null;
  private shouldShowTooltip = false;

  // Use HostBinding instead of direct style manipulation
  @HostBinding('style.cursor') get cursor() {
    return this.shouldShowTooltip ? 'help' : null;
  }

  ngOnInit() {
    this.checkIfTooltipShouldShow();
  }

  ngOnDestroy() {
    this.hideTooltip();
  }

  private checkIfTooltipShouldShow() {
    if (!this.date || !this.location) {
      this.shouldShowTooltip = false;
      return;
    }

    const settings = this.settingsService.state$().settings;
    const userTimezone = settings?.timezone || 'UTC';
    const locationTimezone = this.location.timezone || 'UTC';

    // Only show tooltip if timezones differ
    this.shouldShowTooltip = userTimezone !== locationTimezone;
  }

  @HostListener('mouseenter')
  onMouseEnter() {
    if (this.shouldShowTooltip) {
      this.showTooltip();
    }
  }

  @HostListener('mouseleave')
  onMouseLeave() {
    this.hideTooltip();
  }

  private showTooltip() {
    if (!this.date || this.overlayRef) {
      return;
    }

    const settings = this.settingsService.state$().settings;
    const userTimezone = settings?.timezone || 'UTC';

    try {
      // Convert date to user timezone
      const dt = DateTime.fromJSDate(this.date, { zone: 'UTC' });
      const userTime = dt.setZone(userTimezone);
      const timezoneAbbr = getTimezoneAbbreviation(userTime);

      const tooltipText = `Your time: ${userTime.toFormat('MMM d h:mm a')} ${timezoneAbbr}`;

      // Create overlay position strategy
      const positions: ConnectedPosition[] = [
        {
          originX: 'center',
          originY: 'top',
          overlayX: 'center',
          overlayY: 'bottom',
          offsetY: -8,
        },
        {
          originX: 'center',
          originY: 'bottom',
          overlayX: 'center',
          overlayY: 'top',
          offsetY: 8,
        },
      ];

      const positionStrategy = this.positionBuilder
        .flexibleConnectedTo(this.elementRef)
        .withPositions(positions);

      // Create overlay
      this.overlayRef = this.overlay.create({
        positionStrategy,
        hasBackdrop: false,
        panelClass: 'timezone-tooltip-overlay',
      });

      // Create component and attach to overlay
      const tooltipPortal = new ComponentPortal(
        TimezoneTooltipContentComponent,
        this.viewContainerRef,
      );
      const componentRef: ComponentRef<TimezoneTooltipContentComponent> =
        this.overlayRef.attach(tooltipPortal);
      componentRef.instance.tooltipText = tooltipText;
    } catch (error) {
      console.warn('TimezoneTooltipDirective: Error showing tooltip', error);
    }
  }

  private hideTooltip() {
    if (this.overlayRef) {
      this.overlayRef.dispose();
      this.overlayRef = null;
    }
  }
}
