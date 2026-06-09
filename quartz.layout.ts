import * as Component from "./quartz/components"
import PromptToolbox from "./components/PromptToolbox"

export const sharedPageComponents = {
  head: Component.Head(),
  header: [],
  footer: Component.Footer({
    links: {},
  }),
}

export const defaultContentPageLayout = {
  beforeBody: [
    Component.Breadcrumbs(),
    Component.ArticleTitle(),
    Component.ContentMeta(),
    Component.TagList(),
    PromptToolbox(),
  ],
  pageBody: Component.Content(),
  left: [
    Component.PageTitle(),
    Component.MobileOnly(Component.Spacer()),
    Component.Search(),
    Component.Darkmode(),
    Component.DesktopOnly(Component.Explorer()),
  ],
  right: [
    Component.Graph(),
    Component.DesktopOnly(Component.TableOfContents()),
    Component.Backlinks(),
  ],
  afterBody: [],
}

export const defaultListPageLayout = {
  beforeBody: [Component.Breadcrumbs(), Component.ArticleTitle(), Component.ContentMeta()],
  pageBody: Component.Content(),
  left: [
    Component.PageTitle(),
    Component.MobileOnly(Component.Spacer()),
    Component.Search(),
    Component.Darkmode(),
    Component.DesktopOnly(Component.Explorer()),
  ],
  right: [],
  afterBody: [],
}