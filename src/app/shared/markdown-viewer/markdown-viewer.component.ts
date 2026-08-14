import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { toSignal } from '@angular/core/rxjs-interop';
import { map } from 'rxjs';
import { httpResource } from '@angular/common/http';
import { marked } from 'marked';

@Component({
  selector: 'app-markdown-viewer',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [],
  templateUrl: './markdown-viewer.component.html',
  styleUrl: './markdown-viewer.component.scss',
})
export class MarkdownViewerComponent {

  private readonly route = inject(ActivatedRoute);

  readonly page = toSignal(
    this.route.paramMap.pipe(
      map(params => params.get('seite') ?? 'einleitung')
    ),
    {
      initialValue: 'einleitung'
    }
  )

  readonly resource = httpResource.text(
    () => `/docs/${this.page()}.md`
  );

  readonly html = computed(() => {
    const markdown = this.resource.value();
    return markdown ? marked.parse(markdown) : '';
  });

}
