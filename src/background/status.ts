class Status {
  private status = {
    popupOpen: false,
  };

  constructor() {}



  public getPopupStatus() {
    return this.status.popupOpen
  }

  public setPopupStatus(value: boolean) {
    this.status.popupOpen = value
  }
}

const status = new Status()

export default status
