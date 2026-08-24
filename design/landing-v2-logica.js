
class Component extends DCLogic {
  state = { hov: null, open: null };

  componentDidMount() {
    this._doc = e => {
      if (e.target && e.target.closest && e.target.closest('[data-fn-card]')) return;
      if (this.state.open) this.setState({ open: null });
    };
    document.addEventListener('click', this._doc);
  }
  componentWillUnmount() { document.removeEventListener('click', this._doc); }

  card(k) {
    const open = this.state.open === k;
    const on = open || this.state.hov === k;
    return {
      isOpen: open,
      cardStyle: { position: 'relative', height: '100%', boxSizing: 'border-box', overflow: 'hidden', background: '#fff', border: '1px solid #F1ECE7', borderRadius: '22px', cursor: 'pointer', transition: 'box-shadow .45s ease', zIndex: on ? 6 : 1, boxShadow: on ? '0 22px 44px -20px rgba(244,87,63,0.45)' : 'none' },
      waveStyle: { position: 'absolute', top: 0, bottom: 0, left: 0, width: '100%', background: '#FFF0ED', transition: 'transform .55s cubic-bezier(.66,0,.34,1)', transform: on ? 'translateX(0)' : 'translateX(calc(-100% - 80px))' },
      teaserStyle: { display: 'grid', gridTemplateRows: on ? '0fr' : '1fr', transition: 'grid-template-rows .5s cubic-bezier(.66,0,.34,1), opacity .25s ease', opacity: on ? 0 : 1 },
      expStyle: { position: 'relative', display: 'grid', gridTemplateRows: on ? '1fr' : '0fr', transition: 'grid-template-rows .5s cubic-bezier(.66,0,.34,1), opacity .35s ease', opacity: on ? 1 : 0 },
      enter: () => this.setState({ hov: k }),
      leave: () => this.setState(s => (s.hov === k ? { hov: null } : {})),
      toggle: e => { e.stopPropagation(); this.setState(s => ({ open: s.open === k ? null : k })); },
      close: e => { e.stopPropagation(); this.setState({ open: null }); },
    };
  }

  renderVals() {
    const accent = this.props.accent ?? '#FF6B5B';
    if (typeof document !== 'undefined') document.documentElement.style.setProperty('--acc', accent);
    const o = { waVisible: this.props.whatsappFlotante ?? true };
    for (let i = 1; i <= 5; i++) o['c' + i] = this.card(i);
    return o;
  }
}
